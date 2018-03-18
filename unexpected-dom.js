(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
var matchesSelector = require('./matchesSelector');

function parseHtml(str, isFragment, assertionNameForErrorMessage) {
  if (isFragment) {
    str = '<html><head></head><body>' + str + '</body></html>';
  }
  var htmlDocument;
  if (typeof DOMParser !== 'undefined') {
    // eslint-disable-next-line no-undef
    htmlDocument = new DOMParser().parseFromString(str, 'text/html');
  } else if (
    typeof document !== 'undefined' &&
    document.implementation &&
    document.implementation.createHTMLDocument
  ) {
    htmlDocument = document.implementation.createHTMLDocument('');
    htmlDocument.open();
    htmlDocument.write(str);
    htmlDocument.close();
  } else {
    var jsdom;
    try {
      jsdom = require('' + 'jsdom');
    } catch (err) {
      throw new Error(
        'unexpected-dom' +
          (assertionNameForErrorMessage
            ? ' (' + assertionNameForErrorMessage + ')'
            : '') +
          ': Running outside a browser, but could not find the `jsdom` module. Please npm install jsdom to make this work.'
      );
    }
    if (jsdom.JSDOM) {
      htmlDocument = new jsdom.JSDOM(str).window.document;
    } else {
      htmlDocument = jsdom.jsdom(str);
    }
  }
  if (isFragment) {
    var body = htmlDocument.body;
    var documentFragment = htmlDocument.createDocumentFragment();
    if (body) {
      for (var i = 0; i < body.childNodes.length; i += 1) {
        documentFragment.appendChild(body.childNodes[i].cloneNode(true));
      }
    }
    return documentFragment;
  } else {
    return htmlDocument;
  }
}

function parseXml(str, assertionNameForErrorMessage) {
  if (typeof DOMParser !== 'undefined') {
    // eslint-disable-next-line no-undef
    return new DOMParser().parseFromString(str, 'text/xml');
  } else {
    var jsdom;
    try {
      jsdom = require('' + 'jsdom');
    } catch (err) {
      throw new Error(
        'unexpected-dom' +
          (assertionNameForErrorMessage
            ? ' (' + assertionNameForErrorMessage + ')'
            : '') +
          ': Running outside a browser (or in a browser without DOMParser), but could not find the `jsdom` module. Please npm install jsdom to make this work.'
      );
    }
    if (jsdom.JSDOM) {
      return new jsdom.JSDOM(str, { contentType: 'text/xml' }).window.document;
    } else {
      return jsdom.jsdom(str, { parsingMode: 'xml' });
    }
  }
}

// From html-minifier
var enumeratedAttributeValues = {
  draggable: ['true', 'false'] // defaults to 'auto'
};

function isBooleanAttribute(attrName, attrValue) {
  var isSimpleBoolean = /^(?:allowfullscreen|async|autofocus|autoplay|checked|compact|controls|declare|default|defaultchecked|defaultmuted|defaultselected|defer|disabled|enabled|formnovalidate|hidden|indeterminate|inert|ismap|itemscope|loop|multiple|muted|nohref|noresize|noshade|novalidate|nowrap|open|pauseonexit|readonly|required|reversed|scoped|seamless|selected|sortable|spellcheck|truespeed|typemustmatch|visible)$/i.test(
    attrName
  );
  if (isSimpleBoolean) {
    return true;
  }

  var attrValueEnumeration = enumeratedAttributeValues[attrName.toLowerCase()];
  if (!attrValueEnumeration) {
    return false;
  } else {
    return attrValueEnumeration.indexOf(attrValue.toLowerCase()) === -1;
  }
}

function styleStringToObject(str) {
  var styles = {};

  str.split(';').forEach(function(rule) {
    var tuple = rule.split(':').map(function(part) {
      return part.trim();
    });

    // Guard against empty touples
    if (tuple[0] && tuple[1]) {
      styles[tuple[0]] = tuple[1];
    }
  });

  return styles;
}

function getClassNamesFromAttributeValue(attributeValue) {
  if (attributeValue === null) {
    return '';
  }

  var classNames = attributeValue.split(/\s+/);
  if (classNames.length === 1 && classNames[0] === '') {
    classNames.pop();
  }
  return classNames;
}

function isInsideHtmlDocument(node) {
  var ownerDocument;
  if (node.nodeType === 9 && node.documentElement && node.implementation) {
    ownerDocument = node;
  } else {
    ownerDocument = node.ownerDocument;
  }
  if (ownerDocument.contentType) {
    return ownerDocument.contentType === 'text/html';
  } else {
    return ownerDocument.toString() === '[object HTMLDocument]';
  }
}

function getAttributes(element) {
  var isHtml = isInsideHtmlDocument(element);
  var attrs = element.attributes;
  var result = {};

  for (var i = 0; i < attrs.length; i += 1) {
    if (attrs[i].name === 'class') {
      result[attrs[i].name] =
        (attrs[i].value && attrs[i].value.split(' ')) || [];
    } else if (attrs[i].name === 'style') {
      result[attrs[i].name] = styleStringToObject(attrs[i].value);
    } else {
      result[attrs[i].name] =
        isHtml && isBooleanAttribute(attrs[i].name)
          ? true
          : attrs[i].value || '';
    }
  }

  return result;
}

function getCanonicalAttributes(element) {
  var attrs = getAttributes(element);
  var result = {};

  Object.keys(attrs)
    .sort()
    .forEach(function(key) {
      result[key] = attrs[key];
    });

  return result;
}

function entitify(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function isVoidElement(elementName) {
  return /(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)/i.test(
    elementName
  );
}

function writeAttributeToMagicPen(output, attributeName, value, isHtml) {
  output.prismAttrName(attributeName);
  if (!isHtml || !isBooleanAttribute(attributeName)) {
    if (attributeName === 'class') {
      value = value.join(' ');
    } else if (attributeName === 'style') {
      value = Object.keys(value)
        .map(function(cssProp) {
          return cssProp + ': ' + value[cssProp];
        })
        .join('; ');
    }
    output
      .prismPunctuation('="')
      .prismAttrValue(entitify(value))
      .prismPunctuation('"');
  }
}

function stringifyAttribute(attributeName, value) {
  if (isBooleanAttribute(attributeName)) {
    return attributeName;
  } else if (attributeName === 'class') {
    return 'class="' + value.join(' ') + '"'; // FIXME: entitify
  } else if (attributeName === 'style') {
    return (
      'style="' +
      Object.keys(value)
        .map(function(cssProp) {
          return [cssProp, value[cssProp]].join(': '); // FIXME: entitify
        })
        .join('; ') +
      '"'
    );
  } else {
    return attributeName + '="' + entitify(value) + '"';
  }
}

function stringifyStartTag(element) {
  var elementName =
    element.ownerDocument.contentType === 'text/html'
      ? element.nodeName.toLowerCase()
      : element.nodeName;
  var str = '<' + elementName;
  var attrs = getCanonicalAttributes(element);

  Object.keys(attrs).forEach(function(key) {
    str += ' ' + stringifyAttribute(key, attrs[key]);
  });

  str += '>';
  return str;
}

function stringifyEndTag(element) {
  var isHtml = isInsideHtmlDocument(element);
  var elementName = isHtml ? element.nodeName.toLowerCase() : element.nodeName;
  if (isHtml && isVoidElement(elementName) && element.childNodes.length === 0) {
    return '';
  } else {
    return '</' + elementName + '>';
  }
}

module.exports = {
  name: 'unexpected-dom',
  installInto: function(expect) {
    expect = expect.child();
    expect.use(require('magicpen-prism'));
    var topLevelExpect = expect;
    expect.exportType({
      name: 'DOMNode',
      base: 'object',
      identify: function(obj) {
        return (
          obj &&
          obj.nodeName &&
          [2, 3, 4, 5, 6, 7, 10, 11, 12].indexOf(obj.nodeType) > -1
        );
      },
      equal: function(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function(element, depth, output) {
        return output.code(
          element.nodeName + ' "' + element.nodeValue + '"',
          'prism-string'
        );
      }
    });

    expect.exportType({
      name: 'DOMComment',
      base: 'DOMNode',
      identify: function(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 8;
      },
      equal: function(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function(element, depth, output) {
        return output.code('<!--' + element.nodeValue + '-->', 'html');
      },
      diff: function(actual, expected, output, diff, inspect, equal) {
        var d = diff(
          '<!--' + actual.nodeValue + '-->',
          '<!--' + expected.nodeValue + '-->'
        );
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMTextNode',
      base: 'DOMNode',
      identify: function(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 3;
      },
      equal: function(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function(element, depth, output) {
        return output.code(entitify(element.nodeValue.trim()), 'html');
      },
      diff: function(actual, expected, output, diff, inspect, equal) {
        var d = diff(actual.nodeValue, expected.nodeValue);
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMNodeList',
      base: 'array-like',
      prefix: function(output) {
        return output.text('NodeList[');
      },
      suffix: function(output) {
        return output.text(']');
      },
      similar: function(a, b) {
        // Figure out whether a and b are "struturally similar" so they can be diffed inline.
        return (
          a.nodeType === 1 && b.nodeType === 1 && a.nodeName === b.nodeName
        );
      },
      identify: function(obj) {
        return (
          obj &&
          typeof obj.length === 'number' &&
          typeof obj.toString === 'function' &&
          typeof obj.item === 'function' &&
          // With jsdom 6+, nodeList.toString() comes out as '[object Object]', so fall back to the constructor name:
          (obj.toString().indexOf('NodeList') !== -1 ||
            (obj.constructor && obj.constructor.name === 'NodeList'))
        );
      }
    });

    // Fake type to make it possible to build 'to satisfy' diffs to be rendered inline:
    expect.exportType({
      name: 'attachedDOMNodeList',
      base: 'DOMNodeList',
      indent: false,
      prefix: function(output) {
        return output;
      },
      suffix: function(output) {
        return output;
      },
      delimiter: function(output) {
        return output;
      },
      identify: function(obj) {
        return obj && obj._isAttachedDOMNodeList;
      }
    });

    function makeAttachedDOMNodeList(domNodeList, contentType) {
      var attachedDOMNodeList = [];
      for (var i = 0; i < domNodeList.length; i += 1) {
        attachedDOMNodeList.push(domNodeList[i]);
      }
      attachedDOMNodeList._isAttachedDOMNodeList = true;
      attachedDOMNodeList.ownerDocument = { contentType: contentType };
      return attachedDOMNodeList;
    }

    expect.exportType({
      name: 'HTMLDocType',
      base: 'DOMNode',
      identify: function(obj) {
        return (
          obj &&
          typeof obj.nodeType === 'number' &&
          obj.nodeType === 10 &&
          'publicId' in obj
        );
      },
      inspect: function(doctype, depth, output, inspect) {
        return output.code('<!DOCTYPE ' + doctype.name + '>', 'html');
      },
      equal: function(a, b) {
        return a.toString() === b.toString();
      },
      diff: function(actual, expected, output, diff) {
        var d = diff(
          '<!DOCTYPE ' + actual.name + '>',
          '<!DOCTYPE ' + expected.name + '>'
        );
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMDocument',
      base: 'DOMNode',
      identify: function(obj) {
        return (
          obj &&
          typeof obj.nodeType === 'number' &&
          obj.nodeType === 9 &&
          obj.documentElement &&
          obj.implementation
        );
      },
      inspect: function(document, depth, output, inspect) {
        for (var i = 0; i < document.childNodes.length; i += 1) {
          output.append(inspect(document.childNodes[i]));
        }
        return output;
      },
      diff: function(actual, expected, output, diff, inspect, equal) {
        output.inline = true;
        output.append(
          diff(
            makeAttachedDOMNodeList(actual.childNodes),
            makeAttachedDOMNodeList(expected.childNodes)
          ).diff
        );
        return output;
      }
    });

    expect.exportType({
      name: 'HTMLDocument',
      base: 'DOMDocument',
      identify: function(obj) {
        return this.baseType.identify(obj) && obj.contentType === 'text/html';
      }
    });

    expect.exportType({
      name: 'XMLDocument',
      base: 'DOMDocument',
      identify: function(obj) {
        return (
          this.baseType.identify(obj) &&
          /^(?:application|text)\/xml|\+xml\b/.test(obj.contentType)
        );
      },
      inspect: function(document, depth, output, inspect) {
        output.code('<?xml version="1.0"?>', 'xml');
        for (var i = 0; i < document.childNodes.length; i += 1) {
          output.append(inspect(document.childNodes[i], depth - 1));
        }
        return output;
      }
    });

    expect.exportType({
      name: 'DOMDocumentFragment',
      base: 'DOMNode',
      identify: function(obj) {
        return obj && obj.nodeType === 11; // In jsdom, documentFragment.toString() does not return [object DocumentFragment]
      },
      inspect: function(documentFragment, depth, output, inspect) {
        return output
          .text('DocumentFragment[')
          .append(inspect(documentFragment.childNodes, depth))
          .text(']');
      },
      diff: function(actual, expected, output, diff, inspect, equal) {
        output.inline = true;
        output.block(
          diff(
            makeAttachedDOMNodeList(actual.childNodes),
            makeAttachedDOMNodeList(expected.childNodes)
          ).diff
        );
        return output;
      }
    });

    expect.exportType({
      name: 'DOMElement',
      base: 'DOMNode',
      identify: function(obj) {
        return (
          obj &&
          typeof obj.nodeType === 'number' &&
          obj.nodeType === 1 &&
          obj.nodeName &&
          obj.attributes
        );
      },
      equal: function(a, b, equal) {
        var aIsHtml = isInsideHtmlDocument(a);
        var bIsHtml = isInsideHtmlDocument(b);
        return (
          aIsHtml === bIsHtml &&
          (aIsHtml
            ? a.nodeName.toLowerCase() === b.nodeName.toLowerCase()
            : a.nodeName === b.nodeName) &&
          equal(getAttributes(a), getAttributes(b)) &&
          equal(a.childNodes, b.childNodes)
        );
      },
      inspect: function(element, depth, output, inspect) {
        var elementName = element.nodeName.toLowerCase();
        var startTag = stringifyStartTag(element);

        output.code(startTag, 'html');
        if (element.childNodes.length > 0) {
          if (depth === 1) {
            output.text('...');
          } else {
            var inspectedChildren = [];
            if (elementName === 'script') {
              var type = element.getAttribute('type');
              if (!type || /javascript/.test(type)) {
                type = 'javascript';
              }
              inspectedChildren.push(
                output.clone().code(element.textContent, type)
              );
            } else if (elementName === 'style') {
              inspectedChildren.push(
                output
                  .clone()
                  .code(
                    element.textContent,
                    element.getAttribute('type') || 'text/css'
                  )
              );
            } else {
              for (var i = 0; i < element.childNodes.length; i += 1) {
                inspectedChildren.push(inspect(element.childNodes[i]));
              }
            }

            var width = 0;
            var multipleLines = inspectedChildren.some(function(o) {
              var size = o.size();
              width += size.width;
              return width > 50 || o.height > 1;
            });

            if (multipleLines) {
              output.nl().indentLines();

              inspectedChildren.forEach(function(inspectedChild, index) {
                output
                  .i()
                  .block(inspectedChild)
                  .nl();
              });

              output.outdentLines();
            } else {
              inspectedChildren.forEach(function(inspectedChild, index) {
                output.append(inspectedChild);
              });
            }
          }
        }
        output.code(stringifyEndTag(element), 'html');
        return output;
      },
      diffLimit: 512,
      diff: function(actual, expected, output, diff, inspect, equal) {
        var isHtml = isInsideHtmlDocument(actual);
        output.inline = true;

        if (Math.max(actual.length, expected.length) > this.diffLimit) {
          output.jsComment('Diff suppressed due to size > ' + this.diffLimit);
          return output;
        }

        var emptyElements =
          actual.childNodes.length === 0 && expected.childNodes.length === 0;
        var conflictingElement =
          actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase() ||
          !equal(getAttributes(actual), getAttributes(expected));

        if (conflictingElement) {
          var canContinueLine = true;
          output.prismPunctuation('<').prismTag(actual.nodeName.toLowerCase());
          if (
            actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase()
          ) {
            output
              .sp()
              .annotationBlock(function() {
                this.error('should be')
                  .sp()
                  .prismTag(expected.nodeName.toLowerCase());
              })
              .nl();
            canContinueLine = false;
          }
          var actualAttributes = getAttributes(actual);
          var expectedAttributes = getAttributes(expected);
          Object.keys(actualAttributes).forEach(function(attributeName) {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            writeAttributeToMagicPen(
              output,
              attributeName,
              actualAttributes[attributeName],
              isHtml
            );
            if (attributeName in expectedAttributes) {
              if (
                actualAttributes[attributeName] ===
                expectedAttributes[attributeName]
              ) {
                canContinueLine = true;
              } else {
                output
                  .sp()
                  .annotationBlock(function() {
                    this.error('should equal')
                      .sp()
                      .append(
                        inspect(entitify(expectedAttributes[attributeName]))
                      );
                  })
                  .nl();
                canContinueLine = false;
              }
              delete expectedAttributes[attributeName];
            } else {
              output
                .sp()
                .annotationBlock(function() {
                  this.error('should be removed');
                })
                .nl();
              canContinueLine = false;
            }
          });
          Object.keys(expectedAttributes).forEach(function(attributeName) {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            output
              .annotationBlock(function() {
                this.error('missing').sp();
                writeAttributeToMagicPen(
                  this,
                  attributeName,
                  expectedAttributes[attributeName],
                  isHtml
                );
              })
              .nl();
            canContinueLine = false;
          });
          output.prismPunctuation('>');
        } else {
          output.code(stringifyStartTag(actual), 'html');
        }

        if (!emptyElements) {
          output
            .nl()
            .indentLines()
            .i()
            .block(
              diff(
                makeAttachedDOMNodeList(actual.childNodes),
                makeAttachedDOMNodeList(expected.childNodes)
              ).diff
            )
            .nl()
            .outdentLines();
        }

        output.code(stringifyEndTag(actual), 'html');
        return output;
      }
    });

    expect.exportAssertion(
      '<DOMElement> to have (class|classes) <array|string>',
      function(expect, subject, value) {
        return expect(subject, 'to have attributes', { class: value });
      }
    );

    expect.exportAssertion(
      '<DOMElement> to only have (class|classes) <array|string>',
      function(expect, subject, value) {
        return expect(subject, 'to have attributes', {
          class: function(className) {
            var actualClasses = getClassNamesFromAttributeValue(className);
            if (typeof value === 'string') {
              value = getClassNamesFromAttributeValue(value);
            }
            return topLevelExpect(
              actualClasses.sort(),
              'to equal',
              value.sort()
            );
          }
        });
      }
    );

    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <DOMTextNode>',
      function(expect, subject, value) {
        return expect(subject.nodeValue, 'to equal', value.nodeValue);
      }
    );

    // Avoid rendering a huge object diff when a text node is matched against a different node type:
    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <object>',
      function(expect, subject, value) {
        expect.fail();
      }
    );

    // Necessary because this case would otherwise be handled by the above catch-all for <object>:
    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <regexp>',
      function(expect, subject, value) {
        return expect(subject.nodeValue, 'to satisfy', value);
      }
    );

    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <any>',
      function(expect, subject, value) {
        return expect(subject.nodeValue, 'to satisfy', value);
      }
    );

    function convertDOMNodeToSatisfySpec(node, isHtml) {
      if (node.nodeType === 10) {
        // HTMLDocType
        return { name: node.nodeName };
      } else if (node.nodeType === 1) {
        // DOMElement
        var result = {
          name: isHtml ? node.nodeName.toLowerCase() : node.nodeName
        };
        if (node.attributes) {
          result.attributes = {};
          for (var i = 0; i < node.attributes.length; i += 1) {
            result.attributes[node.attributes[i].name] =
              isHtml && isBooleanAttribute(node.attributes[i].name)
                ? true
                : node.attributes[i].value || '';
          }
        }
        result.children = Array.prototype.map.call(node.childNodes, function(
          childNode
        ) {
          return convertDOMNodeToSatisfySpec(childNode, isHtml);
        });
        return result;
      } else if (node.nodeType === 3) {
        // DOMTextNode
        return node.nodeValue;
      } else {
        throw new Error(
          'to satisfy: Node type ' +
            node.nodeType +
            ' is not yet supported in the value'
        );
      }
    }

    expect.exportAssertion(
      '<DOMNodeList> to [exhaustively] satisfy <string>',
      function(expect, subject, value) {
        var isHtml = subject.ownerDocument.contentType === 'text/html';
        expect.argsOutput = function(output) {
          return output.code(value, isHtml ? 'html' : 'xml');
        };
        return expect(
          subject,
          'to [exhaustively] satisfy',
          (isHtml
            ? parseHtml(value, true, expect.testDescription)
            : parseXml(value, expect.testDescription)
          ).childNodes
        );
      }
    );

    expect.exportAssertion(
      '<DOMNodeList> to [exhaustively] satisfy <DOMNodeList>',
      function(expect, subject, value) {
        var isHtml = subject.ownerDocument.contentType === 'text/html';
        var satisfySpecs = [];
        for (var i = 0; i < value.length; i += 1) {
          satisfySpecs.push(convertDOMNodeToSatisfySpec(value[i], isHtml));
        }
        return expect(subject, 'to [exhaustively] satisfy', satisfySpecs);
      }
    );

    expect.exportAssertion(
      '<DOMDocumentFragment> to [exhaustively] satisfy <string>',
      function(expect, subject, value) {
        var isHtml = isInsideHtmlDocument(subject);
        expect.argsOutput = function(output) {
          return output.code(value, isHtml ? 'html' : 'xml');
        };
        return expect(
          subject,
          'to [exhaustively] satisfy',
          isHtml
            ? parseHtml(value, true, expect.testDescription)
            : parseXml(value, expect.testDescription)
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocumentFragment> to [exhaustively] satisfy <DOMDocumentFragment>',
      function(expect, subject, value) {
        var isHtml = subject.ownerDocument.contentType === 'text/html';
        return expect(
          subject,
          'to [exhaustively] satisfy',
          Array.prototype.map.call(value.childNodes, function(childNode) {
            return convertDOMNodeToSatisfySpec(childNode, isHtml);
          })
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocumentFragment> to [exhaustively] satisfy <object|array>',
      function(expect, subject, value) {
        return expect(subject.childNodes, 'to [exhaustively] satisfy', value);
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <string>',
      function(expect, subject, value) {
        var isHtml = isInsideHtmlDocument(subject);
        var documentFragment = isHtml
          ? parseHtml(value, true, this.testDescription)
          : parseXml(value, this.testDescription);
        if (documentFragment.childNodes.length !== 1) {
          throw new Error(
            'HTMLElement to satisfy string: Only a single node is supported'
          );
        }
        expect.argsOutput = function(output) {
          return output.code(value, isHtml ? 'html' : 'xml');
        };
        return expect(
          subject,
          'to [exhaustively] satisfy',
          documentFragment.childNodes[0]
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocument> to [exhaustively] satisfy <string>',
      function(expect, subject, value) {
        var isHtml = isInsideHtmlDocument(subject);
        var valueDocument = isHtml
          ? parseHtml(value, false, this.testDescription)
          : parseXml(value, this.testDescription);
        return expect(
          makeAttachedDOMNodeList(subject.childNodes),
          'to [exhaustively] satisfy',
          Array.prototype.map.call(valueDocument.childNodes, function(
            childNode
          ) {
            return convertDOMNodeToSatisfySpec(childNode, isHtml);
          })
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocument> to [exhaustively] satisfy <DOMDocument>',
      function(expect, subject, value) {
        var isHtml = isInsideHtmlDocument(subject);
        return expect(
          makeAttachedDOMNodeList(subject.childNodes),
          'to [exhaustively] satisfy',
          Array.prototype.map.call(value.childNodes, function(childNode) {
            return convertDOMNodeToSatisfySpec(childNode, isHtml);
          })
        );
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <DOMElement>',
      function(expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          convertDOMNodeToSatisfySpec(value, isInsideHtmlDocument(subject))
        );
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <DOMTextNode>',
      function(expect, subject, value) {
        expect.fail();
      }
    );

    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <DOMElement>',
      function(expect, subject, value) {
        expect.fail();
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <object>',
      function(expect, subject, value) {
        var isHtml = isInsideHtmlDocument(subject);
        var unsupportedOptions = Object.keys(value).filter(function(key) {
          return (
            key !== 'attributes' &&
            key !== 'name' &&
            key !== 'children' &&
            key !== 'onlyAttributes' &&
            key !== 'textContent'
          );
        });
        if (unsupportedOptions.length > 0) {
          throw new Error(
            'Unsupported option' +
              (unsupportedOptions.length === 1 ? '' : 's') +
              ': ' +
              unsupportedOptions.join(', ')
          );
        }

        var promiseByKey = {
          name: expect.promise(function() {
            if (value && typeof value.name !== 'undefined') {
              return topLevelExpect(
                isHtml ? subject.nodeName.toLowerCase() : subject.nodeName,
                'to satisfy',
                value.name
              );
            }
          }),
          children: expect.promise(function() {
            if (typeof value.children !== 'undefined') {
              if (typeof value.textContent !== 'undefined') {
                throw new Error(
                  'The children and textContent properties are not supported together'
                );
              }
              return topLevelExpect(
                makeAttachedDOMNodeList(
                  subject.childNodes,
                  subject.ownerDocument.contentType
                ),
                'to satisfy',
                value.children
              );
            } else if (typeof value.textContent !== 'undefined') {
              return topLevelExpect(
                subject.textContent,
                'to satisfy',
                value.textContent
              );
            }
          }),
          attributes: {}
        };

        var onlyAttributes =
          (value && value.onlyAttributes) || expect.flags.exhaustively;
        var attrs = getAttributes(subject);
        var expectedAttributes = value && value.attributes;
        var expectedAttributeNames = [];

        if (typeof expectedAttributes !== 'undefined') {
          if (typeof expectedAttributes === 'string') {
            expectedAttributes = [expectedAttributes];
          }
          var expectedValueByAttributeName = {};
          if (Array.isArray(expectedAttributes)) {
            expectedAttributes.forEach(function(attributeName) {
              expectedValueByAttributeName[attributeName] = true;
            });
          } else if (
            expectedAttributes &&
            typeof expectedAttributes === 'object'
          ) {
            expectedValueByAttributeName = expectedAttributes;
          }
          Object.keys(expectedValueByAttributeName).forEach(function(
            attributeName
          ) {
            expectedAttributeNames.push(attributeName);
          });

          expectedAttributeNames.forEach(function(attributeName) {
            var attributeValue = subject.getAttribute(attributeName);
            var expectedAttributeValue =
              expectedValueByAttributeName[attributeName];
            promiseByKey.attributes[attributeName] = expect.promise(function() {
              if (
                attributeName === 'class' &&
                (typeof expectedAttributeValue === 'string' ||
                  Array.isArray(expectedAttributeValue))
              ) {
                var actualClasses = getClassNamesFromAttributeValue(
                  attributeValue
                );
                var expectedClasses = expectedAttributeValue;
                if (typeof expectedClasses === 'string') {
                  expectedClasses = getClassNamesFromAttributeValue(
                    expectedAttributeValue
                  );
                }
                if (onlyAttributes) {
                  return topLevelExpect(
                    actualClasses.sort(),
                    'to equal',
                    expectedClasses.sort()
                  );
                } else {
                  return topLevelExpect.apply(
                    topLevelExpect,
                    [actualClasses, 'to contain'].concat(expectedClasses)
                  );
                }
              } else if (attributeName === 'style') {
                var expectedStyleObj;
                if (typeof expectedValueByAttributeName.style === 'string') {
                  expectedStyleObj = styleStringToObject(
                    expectedValueByAttributeName.style
                  );
                } else {
                  expectedStyleObj = expectedValueByAttributeName.style;
                }

                if (onlyAttributes) {
                  return topLevelExpect(
                    attrs.style,
                    'to exhaustively satisfy',
                    expectedStyleObj
                  );
                } else {
                  return topLevelExpect(
                    attrs.style,
                    'to satisfy',
                    expectedStyleObj
                  );
                }
              } else if (expectedAttributeValue === true) {
                topLevelExpect(
                  subject.hasAttribute(attributeName),
                  'to be true'
                );
              } else if (typeof expectedAttributeValue === 'undefined') {
                topLevelExpect(
                  subject.hasAttribute(attributeName),
                  'to be false'
                );
              } else {
                return topLevelExpect(
                  attributeValue,
                  'to satisfy',
                  expectedAttributeValue
                );
              }
            });
          });

          promiseByKey.attributePresence = expect.promise(function() {
            var attributeNamesExpectedToBeDefined = [];
            expectedAttributeNames.forEach(function(attributeName) {
              if (
                typeof expectedValueByAttributeName[attributeName] ===
                'undefined'
              ) {
                expect(attrs, 'not to have key', attributeName);
              } else {
                attributeNamesExpectedToBeDefined.push(attributeName);
                expect(attrs, 'to have key', attributeName);
              }
            });
            if (onlyAttributes) {
              expect(
                Object.keys(attrs).sort(),
                'to equal',
                attributeNamesExpectedToBeDefined.sort()
              );
            }
          });
        }

        return expect.promise.all(promiseByKey).caught(function() {
          return expect.promise.settle(promiseByKey).then(function() {
            expect.fail({
              diff: function(output, diff, inspect, equal) {
                output.block(function() {
                  var output = this;
                  output
                    .prismPunctuation('<')
                    .prismTag(
                      isHtml ? subject.nodeName.toLowerCase() : subject.nodeName
                    );
                  var canContinueLine = true;
                  if (promiseByKey.name.isRejected()) {
                    var nameError = promiseByKey.name.reason();
                    output
                      .sp()
                      .annotationBlock(function() {
                        this.error(
                          (nameError && nameError.getLabel()) ||
                            'should satisfy'
                        )
                          .sp()
                          .append(inspect(value.name));
                      })
                      .nl();
                    canContinueLine = false;
                  }
                  Object.keys(attrs).forEach(function(attributeName) {
                    var promise = promiseByKey.attributes[attributeName];
                    output.sp(
                      canContinueLine ? 1 : 2 + subject.nodeName.length
                    );
                    writeAttributeToMagicPen(
                      output,
                      attributeName,
                      attrs[attributeName],
                      isHtml
                    );
                    if (
                      (promise && promise.isFulfilled()) ||
                      (!promise &&
                        (!onlyAttributes ||
                          expectedAttributeNames.indexOf(attributeName) !== -1))
                    ) {
                      canContinueLine = true;
                    } else {
                      output
                        .sp()
                        .annotationBlock(function() {
                          if (
                            promise &&
                            typeof expectedValueByAttributeName[
                              attributeName
                            ] !== 'undefined'
                          ) {
                            this.append(promise.reason().getErrorMessage(this));
                          } else {
                            // onlyAttributes === true
                            this.error('should be removed');
                          }
                        })
                        .nl();
                      canContinueLine = false;
                    }
                  });
                  expectedAttributeNames.forEach(function(attributeName) {
                    if (!subject.hasAttribute(attributeName)) {
                      var promise = promiseByKey.attributes[attributeName];
                      if (!promise || promise.isRejected()) {
                        var err = promise && promise.reason();
                        output
                          .nl()
                          .sp(2 + subject.nodeName.length)
                          .annotationBlock(function() {
                            this.error('missing')
                              .sp()
                              .prismAttrName(attributeName, 'html');
                            if (
                              expectedValueByAttributeName[attributeName] !==
                              true
                            ) {
                              this.sp()
                                .error(
                                  (err && err.getLabel()) || 'should satisfy'
                                )
                                .sp()
                                .append(
                                  inspect(
                                    expectedValueByAttributeName[attributeName]
                                  )
                                );
                            }
                          })
                          .nl();
                      }
                      canContinueLine = false;
                    }
                  });
                  output.prismPunctuation('>');
                  var childrenError =
                    promiseByKey.children.isRejected() &&
                    promiseByKey.children.reason();
                  if (childrenError) {
                    var childrenDiff = childrenError.getDiff(output);
                    if (childrenDiff && childrenDiff.inline) {
                      this.nl()
                        .indentLines()
                        .i()
                        .block(childrenDiff.diff)
                        .nl()
                        .outdentLines();
                    } else {
                      output
                        .nl()
                        .indentLines()
                        .i()
                        .block(function() {
                          for (
                            var i = 0;
                            i < subject.childNodes.length;
                            i += 1
                          ) {
                            this.append(inspect(subject.childNodes[i])).nl();
                          }
                        });
                      output.sp().annotationBlock(function() {
                        this.append(childrenError.getErrorMessage(this));
                      });
                      output.nl();
                    }
                  } else {
                    for (var i = 0; i < subject.childNodes.length; i += 1) {
                      this.append(inspect(subject.childNodes[i]));
                    }
                  }
                  output.code(stringifyEndTag(subject), 'html');
                });
                output.inline = true;
                return output;
              }
            });
          });
        });
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [only] have (attribute|attributes) <string+>',
      function(expect, subject, value) {
        return expect(
          subject,
          'to [only] have attributes',
          Array.prototype.slice.call(arguments, 2)
        );
      }
    );

    expect.exportAssertion(
      '<DOMElement> not to have (attribute|attributes) <array>',
      function(expect, subject, value) {
        var attributes = getAttributes(subject);

        value.forEach(function(name) {
          delete attributes[name];
        });

        return expect(subject, 'to only have attributes', attributes);
      }
    );

    expect.exportAssertion(
      '<DOMElement> not to have (attribute|attributes) <string+>',
      function(expect, subject, value) {
        return expect(
          subject,
          'not to have attributes',
          Array.prototype.slice.call(arguments, 2)
        );
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [only] have (attribute|attributes) <array|object>',
      function(expect, subject, value) {
        return expect(subject, 'to satisfy', {
          attributes: value,
          onlyAttributes: expect.flags.only
        });
      }
    );

    expect.exportAssertion('<DOMElement> to have no (child|children)', function(
      expect,
      subject
    ) {
      expect.errorMode = 'nested';
      return expect(
        Array.prototype.slice.call(subject.childNodes),
        'to be an empty array'
      );
    });

    expect.exportAssertion('<DOMElement> to have (child|children)', function(
      expect,
      subject
    ) {
      return expect(subject.childNodes, 'not to be empty');
    });

    expect.exportAssertion(
      '<DOMElement> to have (child|children) <string>',
      function(expect, subject, query) {
        expect.errorMode = 'nested';
        expect(subject.querySelectorAll(query), 'not to be empty');
      }
    );

    expect.exportAssertion('<DOMElement> to have text <any>', function(
      expect,
      subject,
      value
    ) {
      return expect(subject.textContent, 'to satisfy', value);
    });

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [when] queried for [first] <string> <assertion?>',
      function(expect, subject, query) {
        var queryResult;

        expect.argsOutput[0] = function(output) {
          return output.green(query);
        };

        expect.errorMode = 'nested';

        if (expect.flags.first) {
          queryResult = subject.querySelector(query);
          if (!queryResult) {
            expect.fail(function(output) {
              return output
                .error('The selector')
                .sp()
                .jsString(query)
                .sp()
                .error('yielded no results');
            });
          }
        } else {
          queryResult = subject.querySelectorAll(query);
          if (queryResult.length === 0) {
            expect.fail(function(output) {
              return output
                .error('The selector')
                .sp()
                .jsString(query)
                .sp()
                .error('yielded no results');
            });
          }
        }
        return expect.shift(queryResult);
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> to contain [no] elements matching <string>',
      function(expect, subject, query) {
        if (expect.flags.no) {
          return expect(subject.querySelectorAll(query), 'to satisfy', []);
        }
        return expect(subject.querySelectorAll(query), 'not to satisfy', []);
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to match <string>',
      function(expect, subject, query) {
        return expect(
          matchesSelector(subject, query),
          'to be',
          !expect.flags.not
        );
      }
    );

    expect.exportAssertion(
      '<string> [when] parsed as (html|HTML) [fragment] <assertion?>',
      function(expect, subject) {
        expect.errorMode = 'nested';
        return expect.shift(
          parseHtml(subject, expect.flags.fragment, expect.testDescription)
        );
      }
    );

    expect.exportAssertion(
      '<string> [when] parsed as (xml|XML) <assertion?>',
      function(expect, subject) {
        expect.errorMode = 'nested';
        return expect.shift(parseXml(subject, expect.testDescription));
      }
    );
  }
};

},{"./matchesSelector":2,"magicpen-prism":3}],2:[function(require,module,exports){
module.exports = function(elm, selector) {
  var matchFuntion =
    elm.matchesSelector ||
    elm.mozMatchesSelector ||
    elm.msMatchesSelector ||
    elm.oMatchesSelector ||
    elm.webkitMatchesSelector ||
    function(selector) {
      var node = this;
      var nodes = (node.parentNode || node.document).querySelectorAll(selector);
      var i = 0;

      while (nodes[i] && nodes[i] !== node) {
        i += 1;
      }

      return !!nodes[i];
    };

  return matchFuntion.call(elm, selector);
};

},{}],3:[function(require,module,exports){
(function (global){
var oldPrismGlobal = global.Prism;
var prism = global.Prism = require('prismjs');
require('prismjs/components/prism-graphql.js');
require('prismjs/components/prism-csp.js');
global.Prism = oldPrismGlobal;

var defaultTheme = {
    // Adapted from the default Prism theme:
    prismComment: '#708090', // slategray
    prismProlog: 'prismComment',
    prismDoctype: 'prismComment',
    prismCdata: 'prismComment',

    prismPunctuation: '#999',

    prismSymbol: '#905',
    prismProperty: 'prismSymbol',
    prismTag: 'prismSymbol',
    prismBoolean: 'prismSymbol',
    prismNumber: 'prismSymbol',
    prismConstant: 'prismSymbol',
    prismDeleted: 'prismSymbol',

    prismString: '#690',
    prismSelector: 'prismString',
    prismAttrName: 'prismString',
    prismChar: 'prismString',
    prismBuiltin: 'prismString',
    prismInserted: 'prismString',

    prismOperator: '#a67f59',
    prismVariable: 'prismOperator',
    prismEntity: 'prismOperator',
    prismUrl: 'prismOperator',
    prismCssString: 'prismOperator',

    prismKeyword: '#07a',
    prismAtrule: 'prismKeyword',
    prismAttrValue: 'prismKeyword',

    prismFunction: '#DD4A68',

    prismRegex: '#e90',
    prismImportant: ['#e90', 'bold']
};

var languageMapping = {
    'text/html': 'markup',
    'application/xml': 'markup',
    'text/xml': 'markup',
    'application/json': 'javascript',
    'text/javascript': 'javascript',
    'application/javascript': 'javascript',
    'text/css': 'css',
    html: 'markup',
    xml: 'markup',
    c: 'clike',
    'c++': 'clike',
    'cpp': 'clike',
    'c#': 'clike',
    java: 'clike',
    'application/graphql': 'graphql'
};

function upperCamelCase(str) {
    return str.replace(/(?:^|-)([a-z])/g, function ($0, ch) {
        return ch.toUpperCase();
    });
}

module.exports = {
    name: 'magicpen-prism',
    version: require('../package.json').version,
    installInto: function (magicPen) {
        magicPen.installTheme(defaultTheme);

        magicPen.addStyle('code', function (sourceText, language) {
            if (language in languageMapping) {
                language = languageMapping[language];
            } else if (/\+xml\b/.test(language)) {
                language = 'markup';
            }
            if (!(language in prism.languages)) {
                return this.text(sourceText);
            }

            var that = this;
            var capitalizedLanguage = upperCamelCase(language);
            var languageDefinition = prism.languages[language];

            function printTokens(token, parentStyle) {
                if (Array.isArray(token)) {
                    token.forEach(function (subToken) {
                        printTokens(subToken, parentStyle);
                    });
                } else if (typeof token === 'string') {
                    var upperCamelCasedParentStyle = upperCamelCase(parentStyle);
                    token = token.replace(/&lt;/g, '<');
                    if (that['prism' + capitalizedLanguage + upperCamelCasedParentStyle]) {
                        that['prism' + capitalizedLanguage + upperCamelCasedParentStyle](token);
                    } else if (that['prism' + upperCamelCasedParentStyle]) {
                        that['prism' + upperCamelCasedParentStyle](token);
                    } else if (languageDefinition[parentStyle] && languageDefinition[parentStyle].alias) {
                        printTokens(token, languageDefinition[parentStyle].alias);
                    } else {
                        that.text(token);
                    }
                } else {
                    printTokens(token.content, token.type);
                }
            }
            printTokens(prism.tokenize(sourceText, prism.languages[language]), 'text');
        }, true);
    }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../package.json":4,"prismjs":7,"prismjs/components/prism-csp.js":5,"prismjs/components/prism-graphql.js":6}],4:[function(require,module,exports){
module.exports={
  "_from": "magicpen-prism@^2.3.0",
  "_id": "magicpen-prism@2.4.0",
  "_inBundle": false,
  "_integrity": "sha512-OEFZ+xksJtYgwnU5jJqDXhjvgnSFfMsSgXpJ2WWPaBJUXNKuQB0FBAiQxjRKsV5gntpg/tazH8L3apJx5eMdJg==",
  "_location": "/magicpen-prism",
  "_phantomChildren": {},
  "_requested": {
    "type": "range",
    "registry": true,
    "raw": "magicpen-prism@^2.3.0",
    "name": "magicpen-prism",
    "escapedName": "magicpen-prism",
    "rawSpec": "^2.3.0",
    "saveSpec": null,
    "fetchSpec": "^2.3.0"
  },
  "_requiredBy": [
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/magicpen-prism/-/magicpen-prism-2.4.0.tgz",
  "_shasum": "aa79ca9b656f35069ad0aea8b102f1ac8642cbb0",
  "_spec": "magicpen-prism@^2.3.0",
  "_where": "/Users/ssimonsen/Code/unexpected-dom",
  "author": {
    "name": "Andreas Lind",
    "email": "andreas@one.com"
  },
  "bugs": {
    "url": "https://github.com/unexpectedjs/magicpen-prism/issues"
  },
  "bundleDependencies": false,
  "dependencies": {
    "prismjs": "1.11.0"
  },
  "deprecated": false,
  "description": "Add syntax highlighting support to magicpen via prism.js",
  "devDependencies": {
    "browserify": "13.0.0",
    "bundle-collapser": "1.2.1",
    "eslint": "2.13.1",
    "eslint-config-onelint": "1.2.0",
    "magicpen": "5.9.0",
    "mocha": "2.4.5",
    "unexpected": "10.10.5"
  },
  "files": [
    "lib",
    "magicPenPrism.min.js"
  ],
  "homepage": "https://github.com/unexpectedjs/magicpen-prism#readme",
  "main": "lib/magicPenPrism.js",
  "name": "magicpen-prism",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/unexpectedjs/magicpen-prism.git"
  },
  "scripts": {
    "lint": "eslint .",
    "prepublish": "browserify -p bundle-collapser/plugin -e lib/magicPenPrism -s magicPenPrism > magicPenPrism.min.js",
    "test": "mocha",
    "travis": "npm run lint && npm test"
  },
  "version": "2.4.0"
}

},{}],5:[function(require,module,exports){
/**
 * Original by Scott Helme.
 *
 * Reference: https://scotthelme.co.uk/csp-cheat-sheet/
 *
 * Supports the following:
 *  - CSP Level 1
 *  - CSP Level 2
 *  - CSP Level 3
 */

Prism.languages.csp = {
	'directive':  {
             pattern: /\b(?:(?:base-uri|form-action|frame-ancestors|plugin-types|referrer|reflected-xss|report-to|report-uri|require-sri-for|sandbox) |(?:block-all-mixed-content|disown-opener|upgrade-insecure-requests)(?: |;)|(?:child|connect|default|font|frame|img|manifest|media|object|script|style|worker)-src )/i,
             alias: 'keyword'
        },
	'safe': {
            pattern: /'(?:self|none|strict-dynamic|(?:nonce-|sha(?:256|384|512)-)[a-zA-Z0-9+=/]+)'/,
            alias: 'selector'
        },
	'unsafe': {
            pattern: /(?:'unsafe-inline'|'unsafe-eval'|'unsafe-hashed-attributes'|\*)/,
            alias: 'function'
        }
};
},{}],6:[function(require,module,exports){
Prism.languages.graphql = {
	'comment': /#.*/,
	'string': {
		pattern: /"(?:\\.|[^\\"\r\n])*"/,
		greedy: true
	},
	'number': /(?:\B-|\b)\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
	'boolean': /\b(?:true|false)\b/,
	'variable': /\$[a-z_]\w*/i,
	'directive': {
		pattern: /@[a-z_]\w*/i,
		alias: 'function'
	},
	'attr-name': /[a-z_]\w*(?=\s*:)/i,
	'keyword': [
		{
			pattern: /(fragment\s+(?!on)[a-z_]\w*\s+|\.{3}\s*)on\b/,
			lookbehind: true
		},
		/\b(?:query|fragment|mutation)\b/
	],
	'operator': /!|=|\.{3}/,
	'punctuation': /[!(){}\[\]:=,]/
};
},{}],7:[function(require,module,exports){
(function (global){

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(\w+)\b/i;
var uniqueId = 0;

var _ = _self.Prism = {
	manual: _self.Prism && _self.Prism.manual,
	disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					return o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},
	plugins: {},

	highlightAll: function(async, callback) {
		_.highlightAllUnder(document, async, callback);
	},

	highlightAllUnder: function(container, async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || container.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		if (element.parentNode) {
			// Set language on the parent, for styling
			parent = element.parentNode;

			if (/pre/i.test(parent.nodeName)) {
				parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
			}
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		_.hooks.run('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				_.hooks.run('before-highlight', env);
				env.element.textContent = env.code;
				_.hooks.run('after-highlight', env);
			}
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		var Token = _.Token;

		for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str),
					    delNum = 1;

					// Greedy patterns can override/remove up to two previously matched tokens
					if (!match && greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						/*
						 * If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						 * If strarr[k - 1] is greedy we are in conflict with another greedy pattern
						 */
						if (strarr[i] instanceof Token || strarr[k - 1].greedy) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						_.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

	tokenize: function(text, grammar, language) {
		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		_.matchGrammar(text, strarr, grammar, 0, 0, false);

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function(name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}

	if (!_.disableWorkerMessageHandler) {
		// In worker
		_self.addEventListener('message', function (evt) {
			var message = JSON.parse(evt.data),
				lang = message.language,
				code = message.code,
				immediateClose = message.immediateClose;

			_self.postMessage(_.highlight(code, _.languages[lang], lang));
			if (immediateClose) {
				_self.close();
			}
		}, false);
	}

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (!_.manual && !script.hasAttribute('data-manual')) {
		if(document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		}
		else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': /<!DOCTYPE[\s\S]+?>/i,
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+)/i,
				inside: {
					'punctuation': [
						/^=/,
						{
							pattern: /(^|[^\\])["']/,
							lookbehind: true
						}
					]
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] =
	Prism.languages.markup['entity'];

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\s\S]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(?:;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^{}\s][^{};]*?(?=\s*\{)/,
	'string': {
		pattern: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'property': /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css',
			greedy: true
		}
	});

	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /[.\\]/
		}
	},
	'keyword': /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(?:true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+|\d*\.?\d+(?:[Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*\()/i,
	'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[[^\]\r\n]+]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true,
		greedy: true
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=\s*(?:function\b|(?:\([^()]*\)|[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/i,
		alias: 'function'
	}
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\[\s\S]|[^\\`])*`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript',
			greedy: true
		}
	});
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'sh': 'bash',
			'bat': 'batch',
			'h': 'c',
			'tex': 'latex'
		};

		Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
			var src = pre.getAttribute('data-src');

			var language, parent = pre;
			var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
			while (parent && !lang.test(parent.className)) {
				parent = parent.parentNode;
			}

			if (parent) {
				language = (pre.className.match(lang) || [, ''])[1];
			}

			if (!language) {
				var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
				language = Extensions[extension] || extension;
			}

			var code = document.createElement('code');
			code.className = 'language-' + language;

			pre.textContent = '';

			code.textContent = 'Loading…';

			pre.appendChild(code);

			var xhr = new XMLHttpRequest();

			xhr.open('GET', src, true);

			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {

					if (xhr.status < 400 && xhr.responseText) {
						code.textContent = xhr.responseText;

						Prism.highlightElement(code);
					}
					else if (xhr.status >= 400) {
						code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
					}
					else {
						code.textContent = '✖ Error: File does not exist or is empty';
					}
				}
			};

			xhr.send(null);
		});

	};

	document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvbWF0Y2hlc1NlbGVjdG9yLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL2xpYi9tYWdpY1BlblByaXNtLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL3BhY2thZ2UuanNvbiIsIm5vZGVfbW9kdWxlcy9wcmlzbWpzL2NvbXBvbmVudHMvcHJpc20tY3NwLmpzIiwibm9kZV9tb2R1bGVzL3ByaXNtanMvY29tcG9uZW50cy9wcmlzbS1ncmFwaHFsLmpzIiwibm9kZV9tb2R1bGVzL3ByaXNtanMvcHJpc20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ240Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSkoKSIsInZhciBtYXRjaGVzU2VsZWN0b3IgPSByZXF1aXJlKCcuL21hdGNoZXNTZWxlY3RvcicpO1xuXG5mdW5jdGlvbiBwYXJzZUh0bWwoc3RyLCBpc0ZyYWdtZW50LCBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlKSB7XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgc3RyID0gJzxodG1sPjxoZWFkPjwvaGVhZD48Ym9keT4nICsgc3RyICsgJzwvYm9keT48L2h0bWw+JztcbiAgfVxuICB2YXIgaHRtbERvY3VtZW50O1xuICBpZiAodHlwZW9mIERPTVBhcnNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW5kZWZcbiAgICBodG1sRG9jdW1lbnQgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHN0ciwgJ3RleHQvaHRtbCcpO1xuICB9IGVsc2UgaWYgKFxuICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbiAmJlxuICAgIGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudFxuICApIHtcbiAgICBodG1sRG9jdW1lbnQgPSBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVIVE1MRG9jdW1lbnQoJycpO1xuICAgIGh0bWxEb2N1bWVudC5vcGVuKCk7XG4gICAgaHRtbERvY3VtZW50LndyaXRlKHN0cik7XG4gICAgaHRtbERvY3VtZW50LmNsb3NlKCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGpzZG9tO1xuICAgIHRyeSB7XG4gICAgICBqc2RvbSA9IHJlcXVpcmUoJycgKyAnanNkb20nKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ3VuZXhwZWN0ZWQtZG9tJyArXG4gICAgICAgICAgKGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2VcbiAgICAgICAgICAgID8gJyAoJyArIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UgKyAnKSdcbiAgICAgICAgICAgIDogJycpICtcbiAgICAgICAgICAnOiBSdW5uaW5nIG91dHNpZGUgYSBicm93c2VyLCBidXQgY291bGQgbm90IGZpbmQgdGhlIGBqc2RvbWAgbW9kdWxlLiBQbGVhc2UgbnBtIGluc3RhbGwganNkb20gdG8gbWFrZSB0aGlzIHdvcmsuJ1xuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKGpzZG9tLkpTRE9NKSB7XG4gICAgICBodG1sRG9jdW1lbnQgPSBuZXcganNkb20uSlNET00oc3RyKS53aW5kb3cuZG9jdW1lbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGh0bWxEb2N1bWVudCA9IGpzZG9tLmpzZG9tKHN0cik7XG4gICAgfVxuICB9XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgdmFyIGJvZHkgPSBodG1sRG9jdW1lbnQuYm9keTtcbiAgICB2YXIgZG9jdW1lbnRGcmFnbWVudCA9IGh0bWxEb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgaWYgKGJvZHkpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYm9keS5jaGlsZE5vZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGRvY3VtZW50RnJhZ21lbnQuYXBwZW5kQ2hpbGQoYm9keS5jaGlsZE5vZGVzW2ldLmNsb25lTm9kZSh0cnVlKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkb2N1bWVudEZyYWdtZW50O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBodG1sRG9jdW1lbnQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VYbWwoc3RyLCBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlKSB7XG4gIGlmICh0eXBlb2YgRE9NUGFyc2VyICE9PSAndW5kZWZpbmVkJykge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bmRlZlxuICAgIHJldHVybiBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHN0ciwgJ3RleHQveG1sJyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGpzZG9tO1xuICAgIHRyeSB7XG4gICAgICBqc2RvbSA9IHJlcXVpcmUoJycgKyAnanNkb20nKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ3VuZXhwZWN0ZWQtZG9tJyArXG4gICAgICAgICAgKGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2VcbiAgICAgICAgICAgID8gJyAoJyArIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UgKyAnKSdcbiAgICAgICAgICAgIDogJycpICtcbiAgICAgICAgICAnOiBSdW5uaW5nIG91dHNpZGUgYSBicm93c2VyIChvciBpbiBhIGJyb3dzZXIgd2l0aG91dCBET01QYXJzZXIpLCBidXQgY291bGQgbm90IGZpbmQgdGhlIGBqc2RvbWAgbW9kdWxlLiBQbGVhc2UgbnBtIGluc3RhbGwganNkb20gdG8gbWFrZSB0aGlzIHdvcmsuJ1xuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKGpzZG9tLkpTRE9NKSB7XG4gICAgICByZXR1cm4gbmV3IGpzZG9tLkpTRE9NKHN0ciwgeyBjb250ZW50VHlwZTogJ3RleHQveG1sJyB9KS53aW5kb3cuZG9jdW1lbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBqc2RvbS5qc2RvbShzdHIsIHsgcGFyc2luZ01vZGU6ICd4bWwnIH0pO1xuICAgIH1cbiAgfVxufVxuXG4vLyBGcm9tIGh0bWwtbWluaWZpZXJcbnZhciBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzID0ge1xuICBkcmFnZ2FibGU6IFsndHJ1ZScsICdmYWxzZSddIC8vIGRlZmF1bHRzIHRvICdhdXRvJ1xufTtcblxuZnVuY3Rpb24gaXNCb29sZWFuQXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsdWUpIHtcbiAgdmFyIGlzU2ltcGxlQm9vbGVhbiA9IC9eKD86YWxsb3dmdWxsc2NyZWVufGFzeW5jfGF1dG9mb2N1c3xhdXRvcGxheXxjaGVja2VkfGNvbXBhY3R8Y29udHJvbHN8ZGVjbGFyZXxkZWZhdWx0fGRlZmF1bHRjaGVja2VkfGRlZmF1bHRtdXRlZHxkZWZhdWx0c2VsZWN0ZWR8ZGVmZXJ8ZGlzYWJsZWR8ZW5hYmxlZHxmb3Jtbm92YWxpZGF0ZXxoaWRkZW58aW5kZXRlcm1pbmF0ZXxpbmVydHxpc21hcHxpdGVtc2NvcGV8bG9vcHxtdWx0aXBsZXxtdXRlZHxub2hyZWZ8bm9yZXNpemV8bm9zaGFkZXxub3ZhbGlkYXRlfG5vd3JhcHxvcGVufHBhdXNlb25leGl0fHJlYWRvbmx5fHJlcXVpcmVkfHJldmVyc2VkfHNjb3BlZHxzZWFtbGVzc3xzZWxlY3RlZHxzb3J0YWJsZXxzcGVsbGNoZWNrfHRydWVzcGVlZHx0eXBlbXVzdG1hdGNofHZpc2libGUpJC9pLnRlc3QoXG4gICAgYXR0ck5hbWVcbiAgKTtcbiAgaWYgKGlzU2ltcGxlQm9vbGVhbikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGF0dHJWYWx1ZUVudW1lcmF0aW9uID0gZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlc1thdHRyTmFtZS50b0xvd2VyQ2FzZSgpXTtcbiAgaWYgKCFhdHRyVmFsdWVFbnVtZXJhdGlvbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0clZhbHVlRW51bWVyYXRpb24uaW5kZXhPZihhdHRyVmFsdWUudG9Mb3dlckNhc2UoKSkgPT09IC0xO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0eWxlU3RyaW5nVG9PYmplY3Qoc3RyKSB7XG4gIHZhciBzdHlsZXMgPSB7fTtcblxuICBzdHIuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uKHJ1bGUpIHtcbiAgICB2YXIgdHVwbGUgPSBydWxlLnNwbGl0KCc6JykubWFwKGZ1bmN0aW9uKHBhcnQpIHtcbiAgICAgIHJldHVybiBwYXJ0LnRyaW0oKTtcbiAgICB9KTtcblxuICAgIC8vIEd1YXJkIGFnYWluc3QgZW1wdHkgdG91cGxlc1xuICAgIGlmICh0dXBsZVswXSAmJiB0dXBsZVsxXSkge1xuICAgICAgc3R5bGVzW3R1cGxlWzBdXSA9IHR1cGxlWzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSkge1xuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICB2YXIgY2xhc3NOYW1lcyA9IGF0dHJpYnV0ZVZhbHVlLnNwbGl0KC9cXHMrLyk7XG4gIGlmIChjbGFzc05hbWVzLmxlbmd0aCA9PT0gMSAmJiBjbGFzc05hbWVzWzBdID09PSAnJykge1xuICAgIGNsYXNzTmFtZXMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIGNsYXNzTmFtZXM7XG59XG5cbmZ1bmN0aW9uIGlzSW5zaWRlSHRtbERvY3VtZW50KG5vZGUpIHtcbiAgdmFyIG93bmVyRG9jdW1lbnQ7XG4gIGlmIChub2RlLm5vZGVUeXBlID09PSA5ICYmIG5vZGUuZG9jdW1lbnRFbGVtZW50ICYmIG5vZGUuaW1wbGVtZW50YXRpb24pIHtcbiAgICBvd25lckRvY3VtZW50ID0gbm9kZTtcbiAgfSBlbHNlIHtcbiAgICBvd25lckRvY3VtZW50ID0gbm9kZS5vd25lckRvY3VtZW50O1xuICB9XG4gIGlmIChvd25lckRvY3VtZW50LmNvbnRlbnRUeXBlKSB7XG4gICAgcmV0dXJuIG93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBvd25lckRvY3VtZW50LnRvU3RyaW5nKCkgPT09ICdbb2JqZWN0IEhUTUxEb2N1bWVudF0nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZXMoZWxlbWVudCkge1xuICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoZWxlbWVudCk7XG4gIHZhciBhdHRycyA9IGVsZW1lbnQuYXR0cmlidXRlcztcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID1cbiAgICAgICAgKGF0dHJzW2ldLnZhbHVlICYmIGF0dHJzW2ldLnZhbHVlLnNwbGl0KCcgJykpIHx8IFtdO1xuICAgIH0gZWxzZSBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gc3R5bGVTdHJpbmdUb09iamVjdChhdHRyc1tpXS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9XG4gICAgICAgIGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cnNbaV0ubmFtZSlcbiAgICAgICAgICA/IHRydWVcbiAgICAgICAgICA6IGF0dHJzW2ldLnZhbHVlIHx8ICcnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCkge1xuICB2YXIgYXR0cnMgPSBnZXRBdHRyaWJ1dGVzKGVsZW1lbnQpO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpXG4gICAgLnNvcnQoKVxuICAgIC5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICAgIH0pO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGVudGl0aWZ5KHZhbHVlKSB7XG4gIHJldHVybiBTdHJpbmcodmFsdWUpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXG4gICAgLnJlcGxhY2UoLzwvZywgJyZsdDsnKTtcbn1cblxuZnVuY3Rpb24gaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkge1xuICByZXR1cm4gLyg/OmFyZWF8YmFzZXxicnxjb2x8ZW1iZWR8aHJ8aW1nfGlucHV0fGtleWdlbnxsaW5rfG1lbnVpdGVtfG1ldGF8cGFyYW18c291cmNlfHRyYWNrfHdicikvaS50ZXN0KFxuICAgIGVsZW1lbnROYW1lXG4gICk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihvdXRwdXQsIGF0dHJpYnV0ZU5hbWUsIHZhbHVlLCBpc0h0bWwpIHtcbiAgb3V0cHV0LnByaXNtQXR0ck5hbWUoYXR0cmlidXRlTmFtZSk7XG4gIGlmICghaXNIdG1sIHx8ICFpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICBpZiAoYXR0cmlidXRlTmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5qb2luKCcgJyk7XG4gICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICB2YWx1ZSA9IE9iamVjdC5rZXlzKHZhbHVlKVxuICAgICAgICAubWFwKGZ1bmN0aW9uKGNzc1Byb3ApIHtcbiAgICAgICAgICByZXR1cm4gY3NzUHJvcCArICc6ICcgKyB2YWx1ZVtjc3NQcm9wXTtcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJzsgJyk7XG4gICAgfVxuICAgIG91dHB1dFxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJz1cIicpXG4gICAgICAucHJpc21BdHRyVmFsdWUoZW50aXRpZnkodmFsdWUpKVxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJ1wiJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZTtcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgcmV0dXJuICdjbGFzcz1cIicgKyB2YWx1ZS5qb2luKCcgJykgKyAnXCInOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICdzdHlsZT1cIicgK1xuICAgICAgT2JqZWN0LmtleXModmFsdWUpXG4gICAgICAgIC5tYXAoZnVuY3Rpb24oY3NzUHJvcCkge1xuICAgICAgICAgIHJldHVybiBbY3NzUHJvcCwgdmFsdWVbY3NzUHJvcF1dLmpvaW4oJzogJyk7IC8vIEZJWE1FOiBlbnRpdGlmeVxuICAgICAgICB9KVxuICAgICAgICAuam9pbignOyAnKSArXG4gICAgICAnXCInXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZSArICc9XCInICsgZW50aXRpZnkodmFsdWUpICsgJ1wiJztcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9XG4gICAgZWxlbWVudC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJ1xuICAgICAgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKClcbiAgICAgIDogZWxlbWVudC5ub2RlTmFtZTtcbiAgdmFyIHN0ciA9ICc8JyArIGVsZW1lbnROYW1lO1xuICB2YXIgYXR0cnMgPSBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpO1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIHN0ciArPSAnICcgKyBzdHJpbmdpZnlBdHRyaWJ1dGUoa2V5LCBhdHRyc1trZXldKTtcbiAgfSk7XG5cbiAgc3RyICs9ICc+JztcbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGVsZW1lbnQpO1xuICB2YXIgZWxlbWVudE5hbWUgPSBpc0h0bWwgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICBpZiAoaXNIdG1sICYmIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJyc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICc8LycgKyBlbGVtZW50TmFtZSArICc+JztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbmFtZTogJ3VuZXhwZWN0ZWQtZG9tJyxcbiAgaW5zdGFsbEludG86IGZ1bmN0aW9uKGV4cGVjdCkge1xuICAgIGV4cGVjdCA9IGV4cGVjdC5jaGlsZCgpO1xuICAgIGV4cGVjdC51c2UocmVxdWlyZSgnbWFnaWNwZW4tcHJpc20nKSk7XG4gICAgdmFyIHRvcExldmVsRXhwZWN0ID0gZXhwZWN0O1xuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlJyxcbiAgICAgIGJhc2U6ICdvYmplY3QnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iaiAmJlxuICAgICAgICAgIG9iai5ub2RlTmFtZSAmJlxuICAgICAgICAgIFsyLCAzLCA0LCA1LCA2LCA3LCAxMCwgMTEsIDEyXS5pbmRleE9mKG9iai5ub2RlVHlwZSkgPiAtMVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoXG4gICAgICAgICAgZWxlbWVudC5ub2RlTmFtZSArICcgXCInICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnXCInLFxuICAgICAgICAgICdwcmlzbS1zdHJpbmcnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NQ29tbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSA4O1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoJzwhLS0nICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnLS0+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihcbiAgICAgICAgICAnPCEtLScgKyBhY3R1YWwubm9kZVZhbHVlICsgJy0tPicsXG4gICAgICAgICAgJzwhLS0nICsgZXhwZWN0ZWQubm9kZVZhbHVlICsgJy0tPidcbiAgICAgICAgKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01UZXh0Tm9kZScsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoZW50aXRpZnkoZWxlbWVudC5ub2RlVmFsdWUudHJpbSgpKSwgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihhY3R1YWwubm9kZVZhbHVlLCBleHBlY3RlZC5ub2RlVmFsdWUpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdhcnJheS1saWtlJyxcbiAgICAgIHByZWZpeDogZnVuY3Rpb24ob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnTm9kZUxpc3RbJyk7XG4gICAgICB9LFxuICAgICAgc3VmZml4OiBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgc2ltaWxhcjogZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAvLyBGaWd1cmUgb3V0IHdoZXRoZXIgYSBhbmQgYiBhcmUgXCJzdHJ1dHVyYWxseSBzaW1pbGFyXCIgc28gdGhleSBjYW4gYmUgZGlmZmVkIGlubGluZS5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBhLm5vZGVUeXBlID09PSAxICYmIGIubm9kZVR5cGUgPT09IDEgJiYgYS5ub2RlTmFtZSA9PT0gYi5ub2RlTmFtZVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBvYmogJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLmxlbmd0aCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLnRvU3RyaW5nID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5pdGVtID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgLy8gV2l0aCBqc2RvbSA2Kywgbm9kZUxpc3QudG9TdHJpbmcoKSBjb21lcyBvdXQgYXMgJ1tvYmplY3QgT2JqZWN0XScsIHNvIGZhbGwgYmFjayB0byB0aGUgY29uc3RydWN0b3IgbmFtZTpcbiAgICAgICAgICAob2JqLnRvU3RyaW5nKCkuaW5kZXhPZignTm9kZUxpc3QnKSAhPT0gLTEgfHxcbiAgICAgICAgICAgIChvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdOb2RlTGlzdCcpKVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gRmFrZSB0eXBlIHRvIG1ha2UgaXQgcG9zc2libGUgdG8gYnVpbGQgJ3RvIHNhdGlzZnknIGRpZmZzIHRvIGJlIHJlbmRlcmVkIGlubGluZTpcbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnYXR0YWNoZWRET01Ob2RlTGlzdCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZUxpc3QnLFxuICAgICAgaW5kZW50OiBmYWxzZSxcbiAgICAgIHByZWZpeDogZnVuY3Rpb24ob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgc3VmZml4OiBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG4gICAgICBkZWxpbWl0ZXI6IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmouX2lzQXR0YWNoZWRET01Ob2RlTGlzdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGRvbU5vZGVMaXN0LCBjb250ZW50VHlwZSkge1xuICAgICAgdmFyIGF0dGFjaGVkRE9NTm9kZUxpc3QgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9tTm9kZUxpc3QubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgYXR0YWNoZWRET01Ob2RlTGlzdC5wdXNoKGRvbU5vZGVMaXN0W2ldKTtcbiAgICAgIH1cbiAgICAgIGF0dGFjaGVkRE9NTm9kZUxpc3QuX2lzQXR0YWNoZWRET01Ob2RlTGlzdCA9IHRydWU7XG4gICAgICBhdHRhY2hlZERPTU5vZGVMaXN0Lm93bmVyRG9jdW1lbnQgPSB7IGNvbnRlbnRUeXBlOiBjb250ZW50VHlwZSB9O1xuICAgICAgcmV0dXJuIGF0dGFjaGVkRE9NTm9kZUxpc3Q7XG4gICAgfVxuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2NUeXBlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBvYmogJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgICAgICAgIG9iai5ub2RlVHlwZSA9PT0gMTAgJiZcbiAgICAgICAgICAncHVibGljSWQnIGluIG9ialxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uKGRvY3R5cGUsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKCc8IURPQ1RZUEUgJyArIGRvY3R5cGUubmFtZSArICc+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gYS50b1N0cmluZygpID09PSBiLnRvU3RyaW5nKCk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihcbiAgICAgICAgICAnPCFET0NUWVBFICcgKyBhY3R1YWwubmFtZSArICc+JyxcbiAgICAgICAgICAnPCFET0NUWVBFICcgKyBleHBlY3RlZC5uYW1lICsgJz4nXG4gICAgICAgICk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iaiAmJlxuICAgICAgICAgIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgICAgICAgb2JqLm5vZGVUeXBlID09PSA5ICYmXG4gICAgICAgICAgb2JqLmRvY3VtZW50RWxlbWVudCAmJlxuICAgICAgICAgIG9iai5pbXBsZW1lbnRhdGlvblxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdChkb2N1bWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIG91dHB1dC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICBvdXRwdXQuYXBwZW5kKFxuICAgICAgICAgIGRpZmYoXG4gICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChhY3R1YWwuY2hpbGROb2RlcyksXG4gICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChleHBlY3RlZC5jaGlsZE5vZGVzKVxuICAgICAgICAgICkuZGlmZlxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIG9iai5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnWE1MRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTURvY3VtZW50JyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICB0aGlzLmJhc2VUeXBlLmlkZW50aWZ5KG9iaikgJiZcbiAgICAgICAgICAvXig/OmFwcGxpY2F0aW9ufHRleHQpXFwveG1sfFxcK3htbFxcYi8udGVzdChvYmouY29udGVudFR5cGUpXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZG9jdW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgb3V0cHV0LmNvZGUoJzw/eG1sIHZlcnNpb249XCIxLjBcIj8+JywgJ3htbCcpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSwgZGVwdGggLSAxKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Eb2N1bWVudEZyYWdtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDExOyAvLyBJbiBqc2RvbSwgZG9jdW1lbnRGcmFnbWVudC50b1N0cmluZygpIGRvZXMgbm90IHJldHVybiBbb2JqZWN0IERvY3VtZW50RnJhZ21lbnRdXG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZG9jdW1lbnRGcmFnbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0XG4gICAgICAgICAgLnRleHQoJ0RvY3VtZW50RnJhZ21lbnRbJylcbiAgICAgICAgICAuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnRGcmFnbWVudC5jaGlsZE5vZGVzLCBkZXB0aCkpXG4gICAgICAgICAgLnRleHQoJ10nKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIG91dHB1dC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICBvdXRwdXQuYmxvY2soXG4gICAgICAgICAgZGlmZihcbiAgICAgICAgICAgIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGFjdHVhbC5jaGlsZE5vZGVzKSxcbiAgICAgICAgICAgIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGV4cGVjdGVkLmNoaWxkTm9kZXMpXG4gICAgICAgICAgKS5kaWZmXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRWxlbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgb2JqICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICBvYmoubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgICAgICBvYmoubm9kZU5hbWUgJiZcbiAgICAgICAgICBvYmouYXR0cmlidXRlc1xuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbihhLCBiLCBlcXVhbCkge1xuICAgICAgICB2YXIgYUlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGEpO1xuICAgICAgICB2YXIgYklzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGIpO1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIGFJc0h0bWwgPT09IGJJc0h0bWwgJiZcbiAgICAgICAgICAoYUlzSHRtbFxuICAgICAgICAgICAgPyBhLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGIubm9kZU5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgOiBhLm5vZGVOYW1lID09PSBiLm5vZGVOYW1lKSAmJlxuICAgICAgICAgIGVxdWFsKGdldEF0dHJpYnV0ZXMoYSksIGdldEF0dHJpYnV0ZXMoYikpICYmXG4gICAgICAgICAgZXF1YWwoYS5jaGlsZE5vZGVzLCBiLmNoaWxkTm9kZXMpXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZWxlbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBzdGFydFRhZyA9IHN0cmluZ2lmeVN0YXJ0VGFnKGVsZW1lbnQpO1xuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0YXJ0VGFnLCAnaHRtbCcpO1xuICAgICAgICBpZiAoZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBpZiAoZGVwdGggPT09IDEpIHtcbiAgICAgICAgICAgIG91dHB1dC50ZXh0KCcuLi4nKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGluc3BlY3RlZENoaWxkcmVuID0gW107XG4gICAgICAgICAgICBpZiAoZWxlbWVudE5hbWUgPT09ICdzY3JpcHQnKSB7XG4gICAgICAgICAgICAgIHZhciB0eXBlID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKTtcbiAgICAgICAgICAgICAgaWYgKCF0eXBlIHx8IC9qYXZhc2NyaXB0Ly50ZXN0KHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdqYXZhc2NyaXB0JztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKFxuICAgICAgICAgICAgICAgIG91dHB1dC5jbG9uZSgpLmNvZGUoZWxlbWVudC50ZXh0Q29udGVudCwgdHlwZSlcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5jbG9uZSgpXG4gICAgICAgICAgICAgICAgICAuY29kZShcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC50ZXh0Q29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKSB8fCAndGV4dC9jc3MnXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2goaW5zcGVjdChlbGVtZW50LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd2lkdGggPSAwO1xuICAgICAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgICAgICAgdmFyIHNpemUgPSBvLnNpemUoKTtcbiAgICAgICAgICAgICAgd2lkdGggKz0gc2l6ZS53aWR0aDtcbiAgICAgICAgICAgICAgcmV0dXJuIHdpZHRoID4gNTAgfHwgby5oZWlnaHQgPiAxO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChtdWx0aXBsZUxpbmVzKSB7XG4gICAgICAgICAgICAgIG91dHB1dC5ubCgpLmluZGVudExpbmVzKCk7XG5cbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5pKClcbiAgICAgICAgICAgICAgICAgIC5ibG9jayhpbnNwZWN0ZWRDaGlsZClcbiAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICBvdXRwdXQub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdGVkQ2hpbGQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIGRpZmZMaW1pdDogNTEyLFxuICAgICAgZGlmZjogZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoYWN0dWFsKTtcbiAgICAgICAgb3V0cHV0LmlubGluZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCkgPiB0aGlzLmRpZmZMaW1pdCkge1xuICAgICAgICAgIG91dHB1dC5qc0NvbW1lbnQoJ0RpZmYgc3VwcHJlc3NlZCBkdWUgdG8gc2l6ZSA+ICcgKyB0aGlzLmRpZmZMaW1pdCk7XG4gICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbXB0eUVsZW1lbnRzID1cbiAgICAgICAgICBhY3R1YWwuY2hpbGROb2Rlcy5sZW5ndGggPT09IDAgJiYgZXhwZWN0ZWQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDA7XG4gICAgICAgIHZhciBjb25mbGljdGluZ0VsZW1lbnQgPVxuICAgICAgICAgIGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIHx8XG4gICAgICAgICAgIWVxdWFsKGdldEF0dHJpYnV0ZXMoYWN0dWFsKSwgZ2V0QXR0cmlidXRlcyhleHBlY3RlZCkpO1xuXG4gICAgICAgIGlmIChjb25mbGljdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgICB2YXIgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPCcpLnByaXNtVGFnKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAhPT0gZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlJylcbiAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAucHJpc21UYWcoZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBhY3R1YWxBdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhhY3R1YWwpO1xuICAgICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZXMgPSBnZXRBdHRyaWJ1dGVzKGV4cGVjdGVkKTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhhY3R1YWxBdHRyaWJ1dGVzKS5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgIG91dHB1dC5zcChjYW5Db250aW51ZUxpbmUgPyAxIDogMiArIGFjdHVhbC5ub2RlTmFtZS5sZW5ndGgpO1xuICAgICAgICAgICAgd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKFxuICAgICAgICAgICAgICBvdXRwdXQsXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICAgIGFjdHVhbEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0sXG4gICAgICAgICAgICAgIGlzSHRtbFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVOYW1lIGluIGV4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgYWN0dWFsQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9PT1cbiAgICAgICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV1cbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgZXF1YWwnKVxuICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3BlY3QoZW50aXRpZnkoZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdKSlcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgYmUgcmVtb3ZlZCcpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoY2FuQ29udGludWVMaW5lID8gMSA6IDIgKyBhY3R1YWwubm9kZU5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ21pc3NpbmcnKS5zcCgpO1xuICAgICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihcbiAgICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLFxuICAgICAgICAgICAgICAgICAgaXNIdG1sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeVN0YXJ0VGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVtcHR5RWxlbWVudHMpIHtcbiAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAuaW5kZW50TGluZXMoKVxuICAgICAgICAgICAgLmkoKVxuICAgICAgICAgICAgLmJsb2NrKFxuICAgICAgICAgICAgICBkaWZmKFxuICAgICAgICAgICAgICAgIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGFjdHVhbC5jaGlsZE5vZGVzKSxcbiAgICAgICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChleHBlY3RlZC5jaGlsZE5vZGVzKVxuICAgICAgICAgICAgICApLmRpZmZcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAub3V0ZGVudExpbmVzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIGhhdmUgKGNsYXNzfGNsYXNzZXMpIDxhcnJheXxzdHJpbmc+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywgeyBjbGFzczogdmFsdWUgfSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIG9ubHkgaGF2ZSAoY2xhc3N8Y2xhc3NlcykgPGFycmF5fHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBoYXZlIGF0dHJpYnV0ZXMnLCB7XG4gICAgICAgICAgY2xhc3M6IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB2YWx1ZSA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KFxuICAgICAgICAgICAgICBhY3R1YWxDbGFzc2VzLnNvcnQoKSxcbiAgICAgICAgICAgICAgJ3RvIGVxdWFsJyxcbiAgICAgICAgICAgICAgdmFsdWUuc29ydCgpXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01UZXh0Tm9kZT4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3Qubm9kZVZhbHVlLCAndG8gZXF1YWwnLCB2YWx1ZS5ub2RlVmFsdWUpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBdm9pZCByZW5kZXJpbmcgYSBodWdlIG9iamVjdCBkaWZmIHdoZW4gYSB0ZXh0IG5vZGUgaXMgbWF0Y2hlZCBhZ2FpbnN0IGEgZGlmZmVyZW50IG5vZGUgdHlwZTpcbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01UZXh0Tm9kZT4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8b2JqZWN0PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIGV4cGVjdC5mYWlsKCk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIE5lY2Vzc2FyeSBiZWNhdXNlIHRoaXMgY2FzZSB3b3VsZCBvdGhlcndpc2UgYmUgaGFuZGxlZCBieSB0aGUgYWJvdmUgY2F0Y2gtYWxsIGZvciA8b2JqZWN0PjpcbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01UZXh0Tm9kZT4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8cmVnZXhwPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5ub2RlVmFsdWUsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01UZXh0Tm9kZT4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8YW55PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5ub2RlVmFsdWUsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBmdW5jdGlvbiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMobm9kZSwgaXNIdG1sKSB7XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gMTApIHtcbiAgICAgICAgLy8gSFRNTERvY1R5cGVcbiAgICAgICAgcmV0dXJuIHsgbmFtZTogbm9kZS5ub2RlTmFtZSB9O1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSAxKSB7XG4gICAgICAgIC8vIERPTUVsZW1lbnRcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBuYW1lOiBpc0h0bWwgPyBub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBub2RlLm5vZGVOYW1lXG4gICAgICAgIH07XG4gICAgICAgIGlmIChub2RlLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICByZXN1bHQuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5hdHRyaWJ1dGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICByZXN1bHQuYXR0cmlidXRlc1tub2RlLmF0dHJpYnV0ZXNbaV0ubmFtZV0gPVxuICAgICAgICAgICAgICBpc0h0bWwgJiYgaXNCb29sZWFuQXR0cmlidXRlKG5vZGUuYXR0cmlidXRlc1tpXS5uYW1lKVxuICAgICAgICAgICAgICAgID8gdHJ1ZVxuICAgICAgICAgICAgICAgIDogbm9kZS5hdHRyaWJ1dGVzW2ldLnZhbHVlIHx8ICcnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuY2hpbGRyZW4gPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwobm9kZS5jaGlsZE5vZGVzLCBmdW5jdGlvbihcbiAgICAgICAgICBjaGlsZE5vZGVcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIC8vIERPTVRleHROb2RlXG4gICAgICAgIHJldHVybiBub2RlLm5vZGVWYWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAndG8gc2F0aXNmeTogTm9kZSB0eXBlICcgK1xuICAgICAgICAgICAgbm9kZS5ub2RlVHlwZSArXG4gICAgICAgICAgICAnIGlzIG5vdCB5ZXQgc3VwcG9ydGVkIGluIHRoZSB2YWx1ZSdcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01Ob2RlTGlzdD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8c3RyaW5nPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBzdWJqZWN0Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgIHJldHVybiBvdXRwdXQuY29kZSh2YWx1ZSwgaXNIdG1sID8gJ2h0bWwnIDogJ3htbCcpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLFxuICAgICAgICAgIChpc0h0bWxcbiAgICAgICAgICAgID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlLCBleHBlY3QudGVzdERlc2NyaXB0aW9uKVxuICAgICAgICAgICAgOiBwYXJzZVhtbCh2YWx1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbilcbiAgICAgICAgICApLmNoaWxkTm9kZXNcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NTm9kZUxpc3Q+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTU5vZGVMaXN0PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBzdWJqZWN0Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgICB2YXIgc2F0aXNmeVNwZWNzID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBzYXRpc2Z5U3BlY3MucHVzaChjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWModmFsdWVbaV0sIGlzSHRtbCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBzYXRpc2Z5U3BlY3MpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01Eb2N1bWVudEZyYWdtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxzdHJpbmc+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuICAgICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgIHJldHVybiBvdXRwdXQuY29kZSh2YWx1ZSwgaXNIdG1sID8gJ2h0bWwnIDogJ3htbCcpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLFxuICAgICAgICAgIGlzSHRtbFxuICAgICAgICAgICAgPyBwYXJzZUh0bWwodmFsdWUsIHRydWUsIGV4cGVjdC50ZXN0RGVzY3JpcHRpb24pXG4gICAgICAgICAgICA6IHBhcnNlWG1sKHZhbHVlLCBleHBlY3QudGVzdERlc2NyaXB0aW9uKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01Eb2N1bWVudEZyYWdtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01Eb2N1bWVudEZyYWdtZW50PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBzdWJqZWN0Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLFxuICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCh2YWx1ZS5jaGlsZE5vZGVzLCBmdW5jdGlvbihjaGlsZE5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMoY2hpbGROb2RlLCBpc0h0bWwpO1xuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTURvY3VtZW50RnJhZ21lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPG9iamVjdHxhcnJheT4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QuY2hpbGROb2RlcywgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICAgIHZhciBkb2N1bWVudEZyYWdtZW50ID0gaXNIdG1sXG4gICAgICAgICAgPyBwYXJzZUh0bWwodmFsdWUsIHRydWUsIHRoaXMudGVzdERlc2NyaXB0aW9uKVxuICAgICAgICAgIDogcGFyc2VYbWwodmFsdWUsIHRoaXMudGVzdERlc2NyaXB0aW9uKTtcbiAgICAgICAgaWYgKGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2Rlcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnSFRNTEVsZW1lbnQgdG8gc2F0aXNmeSBzdHJpbmc6IE9ubHkgYSBzaW5nbGUgbm9kZSBpcyBzdXBwb3J0ZWQnXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgIHJldHVybiBvdXRwdXQuY29kZSh2YWx1ZSwgaXNIdG1sID8gJ2h0bWwnIDogJ3htbCcpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLFxuICAgICAgICAgIGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2Rlc1swXVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01Eb2N1bWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8c3RyaW5nPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgICAgdmFyIHZhbHVlRG9jdW1lbnQgPSBpc0h0bWxcbiAgICAgICAgICA/IHBhcnNlSHRtbCh2YWx1ZSwgZmFsc2UsIHRoaXMudGVzdERlc2NyaXB0aW9uKVxuICAgICAgICAgIDogcGFyc2VYbWwodmFsdWUsIHRoaXMudGVzdERlc2NyaXB0aW9uKTtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChzdWJqZWN0LmNoaWxkTm9kZXMpLFxuICAgICAgICAgICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JyxcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodmFsdWVEb2N1bWVudC5jaGlsZE5vZGVzLCBmdW5jdGlvbihcbiAgICAgICAgICAgIGNoaWxkTm9kZVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTURvY3VtZW50PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChzdWJqZWN0LmNoaWxkTm9kZXMpLFxuICAgICAgICAgICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JyxcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodmFsdWUuY2hpbGROb2RlcywgZnVuY3Rpb24oY2hpbGROb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01FbGVtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01FbGVtZW50PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBleHBlY3QoXG4gICAgICAgICAgc3ViamVjdCxcbiAgICAgICAgICAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsXG4gICAgICAgICAgY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlLCBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NVGV4dE5vZGU+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgZXhwZWN0LmZhaWwoKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTUVsZW1lbnQ+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgZXhwZWN0LmZhaWwoKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8b2JqZWN0PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgICAgdmFyIHVuc3VwcG9ydGVkT3B0aW9ucyA9IE9iamVjdC5rZXlzKHZhbHVlKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIGtleSAhPT0gJ2F0dHJpYnV0ZXMnICYmXG4gICAgICAgICAgICBrZXkgIT09ICduYW1lJyAmJlxuICAgICAgICAgICAga2V5ICE9PSAnY2hpbGRyZW4nICYmXG4gICAgICAgICAgICBrZXkgIT09ICdvbmx5QXR0cmlidXRlcycgJiZcbiAgICAgICAgICAgIGtleSAhPT0gJ3RleHRDb250ZW50J1xuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnVW5zdXBwb3J0ZWQgb3B0aW9uJyArXG4gICAgICAgICAgICAgICh1bnN1cHBvcnRlZE9wdGlvbnMubGVuZ3RoID09PSAxID8gJycgOiAncycpICtcbiAgICAgICAgICAgICAgJzogJyArXG4gICAgICAgICAgICAgIHVuc3VwcG9ydGVkT3B0aW9ucy5qb2luKCcsICcpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcm9taXNlQnlLZXkgPSB7XG4gICAgICAgICAgbmFtZTogZXhwZWN0LnByb21pc2UoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLm5hbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChcbiAgICAgICAgICAgICAgICBpc0h0bWwgPyBzdWJqZWN0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBzdWJqZWN0Lm5vZGVOYW1lLFxuICAgICAgICAgICAgICAgICd0byBzYXRpc2Z5JyxcbiAgICAgICAgICAgICAgICB2YWx1ZS5uYW1lXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICAgY2hpbGRyZW46IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5jaGlsZHJlbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS50ZXh0Q29udGVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAnVGhlIGNoaWxkcmVuIGFuZCB0ZXh0Q29udGVudCBwcm9wZXJ0aWVzIGFyZSBub3Qgc3VwcG9ydGVkIHRvZ2V0aGVyJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KFxuICAgICAgICAgICAgICAgIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KFxuICAgICAgICAgICAgICAgICAgc3ViamVjdC5jaGlsZE5vZGVzLFxuICAgICAgICAgICAgICAgICAgc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAndG8gc2F0aXNmeScsXG4gICAgICAgICAgICAgICAgdmFsdWUuY2hpbGRyZW5cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlLnRleHRDb250ZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoXG4gICAgICAgICAgICAgICAgc3ViamVjdC50ZXh0Q29udGVudCxcbiAgICAgICAgICAgICAgICAndG8gc2F0aXNmeScsXG4gICAgICAgICAgICAgICAgdmFsdWUudGV4dENvbnRlbnRcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSxcbiAgICAgICAgICBhdHRyaWJ1dGVzOiB7fVxuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBvbmx5QXR0cmlidXRlcyA9XG4gICAgICAgICAgKHZhbHVlICYmIHZhbHVlLm9ubHlBdHRyaWJ1dGVzKSB8fCBleHBlY3QuZmxhZ3MuZXhoYXVzdGl2ZWx5O1xuICAgICAgICB2YXIgYXR0cnMgPSBnZXRBdHRyaWJ1dGVzKHN1YmplY3QpO1xuICAgICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gdmFsdWUgJiYgdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMgPSBbXTtcblxuICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcyA9IFtleHBlY3RlZEF0dHJpYnV0ZXNdO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSA9IHt9O1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXSA9IHRydWU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICB0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVzID09PSAnb2JqZWN0J1xuICAgICAgICAgICkge1xuICAgICAgICAgICAgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSA9IGV4cGVjdGVkQXR0cmlidXRlcztcbiAgICAgICAgICB9XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSkuZm9yRWFjaChmdW5jdGlvbihcbiAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMucHVzaChhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICB2YXIgYXR0cmlidXRlVmFsdWUgPSBzdWJqZWN0LmdldEF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID1cbiAgICAgICAgICAgICAgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gZXhwZWN0LnByb21pc2UoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnICYmXG4gICAgICAgICAgICAgICAgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKSlcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKFxuICAgICAgICAgICAgICAgICAgYXR0cmlidXRlVmFsdWVcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHZhciBleHBlY3RlZENsYXNzZXMgPSBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRDbGFzc2VzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRDbGFzc2VzID0gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoXG4gICAgICAgICAgICAgICAgICAgIGFjdHVhbENsYXNzZXMuc29ydCgpLFxuICAgICAgICAgICAgICAgICAgICAndG8gZXF1YWwnLFxuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZENsYXNzZXMuc29ydCgpXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QuYXBwbHkoXG4gICAgICAgICAgICAgICAgICAgIHRvcExldmVsRXhwZWN0LFxuICAgICAgICAgICAgICAgICAgICBbYWN0dWFsQ2xhc3NlcywgJ3RvIGNvbnRhaW4nXS5jb25jYXQoZXhwZWN0ZWRDbGFzc2VzKVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlTmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICAgICAgICAgIHZhciBleHBlY3RlZFN0eWxlT2JqO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgIGV4cGVjdGVkU3R5bGVPYmogPSBzdHlsZVN0cmluZ1RvT2JqZWN0KFxuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBleHBlY3RlZFN0eWxlT2JqID0gZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob25seUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChcbiAgICAgICAgICAgICAgICAgICAgYXR0cnMuc3R5bGUsXG4gICAgICAgICAgICAgICAgICAgICd0byBleGhhdXN0aXZlbHkgc2F0aXNmeScsXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkU3R5bGVPYmpcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChcbiAgICAgICAgICAgICAgICAgICAgYXR0cnMuc3R5bGUsXG4gICAgICAgICAgICAgICAgICAgICd0byBzYXRpc2Z5JyxcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9ialxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHRvcExldmVsRXhwZWN0KFxuICAgICAgICAgICAgICAgICAgc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksXG4gICAgICAgICAgICAgICAgICAndG8gYmUgdHJ1ZSdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHRvcExldmVsRXhwZWN0KFxuICAgICAgICAgICAgICAgICAgc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksXG4gICAgICAgICAgICAgICAgICAndG8gYmUgZmFsc2UnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVWYWx1ZSxcbiAgICAgICAgICAgICAgICAgICd0byBzYXRpc2Z5JyxcbiAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlVmFsdWVcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVQcmVzZW5jZSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZCA9IFtdO1xuICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID09PVxuICAgICAgICAgICAgICAgICd1bmRlZmluZWQnXG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ25vdCB0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5wdXNoKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ3RvIGhhdmUga2V5JywgYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgIGV4cGVjdChcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhhdHRycykuc29ydCgpLFxuICAgICAgICAgICAgICAgICd0byBlcXVhbCcsXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkLnNvcnQoKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4cGVjdC5wcm9taXNlLmFsbChwcm9taXNlQnlLZXkpLmNhdWdodChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gZXhwZWN0LnByb21pc2Uuc2V0dGxlKHByb21pc2VCeUtleSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGV4cGVjdC5mYWlsKHtcbiAgICAgICAgICAgICAgZGlmZjogZnVuY3Rpb24ob3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5ibG9jayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBvdXRwdXQgPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc8JylcbiAgICAgICAgICAgICAgICAgICAgLnByaXNtVGFnKFxuICAgICAgICAgICAgICAgICAgICAgIGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWVcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIHZhciBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgaWYgKHByb21pc2VCeUtleS5uYW1lLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZUVycm9yID0gcHJvbWlzZUJ5S2V5Lm5hbWUucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmFubm90YXRpb25CbG9jayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChuYW1lRXJyb3IgJiYgbmFtZUVycm9yLmdldExhYmVsKCkpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3Nob3VsZCBzYXRpc2Z5J1xuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKGluc3BlY3QodmFsdWUubmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IHByb21pc2VCeUtleS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoXG4gICAgICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID8gMSA6IDIgKyBzdWJqZWN0Lm5vZGVOYW1lLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4oXG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LFxuICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgYXR0cnNbYXR0cmlidXRlTmFtZV0sXG4gICAgICAgICAgICAgICAgICAgICAgaXNIdG1sXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAocHJvbWlzZSAmJiBwcm9taXNlLmlzRnVsZmlsbGVkKCkpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgKCFwcm9taXNlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAoIW9ubHlBdHRyaWJ1dGVzIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuaW5kZXhPZihhdHRyaWJ1dGVOYW1lKSAhPT0gLTEpKVxuICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQocHJvbWlzZS5yZWFzb24oKS5nZXRFcnJvck1lc3NhZ2UodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9ubHlBdHRyaWJ1dGVzID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlIHJlbW92ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IHByb21pc2VCeUtleS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghcHJvbWlzZSB8fCBwcm9taXNlLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHByb21pc2UgJiYgcHJvbWlzZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoMiArIHN1YmplY3Qubm9kZU5hbWUubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ21pc3NpbmcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcmlzbUF0dHJOYW1lKGF0dHJpYnV0ZU5hbWUsICdodG1sJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXSAhPT1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGVyciAmJiBlcnIuZ2V0TGFiZWwoKSkgfHwgJ3Nob3VsZCBzYXRpc2Z5J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zcGVjdChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAubmwoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgb3V0cHV0LnByaXNtUHVuY3R1YXRpb24oJz4nKTtcbiAgICAgICAgICAgICAgICAgIHZhciBjaGlsZHJlbkVycm9yID1cbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZUJ5S2V5LmNoaWxkcmVuLmlzUmVqZWN0ZWQoKSAmJlxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlQnlLZXkuY2hpbGRyZW4ucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGRyZW5EaWZmID0gY2hpbGRyZW5FcnJvci5nZXREaWZmKG91dHB1dCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbkRpZmYgJiYgY2hpbGRyZW5EaWZmLmlubGluZSkge1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMubmwoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5pKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ibG9jayhjaGlsZHJlbkRpZmYuZGlmZilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5pKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ibG9jayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaSA8IHN1YmplY3QuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaSArPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGluc3BlY3Qoc3ViamVjdC5jaGlsZE5vZGVzW2ldKSkubmwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnNwKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoY2hpbGRyZW5FcnJvci5nZXRFcnJvck1lc3NhZ2UodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5ubCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YmplY3QuY2hpbGROb2Rlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGluc3BlY3Qoc3ViamVjdC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhzdWJqZWN0KSwgJ2h0bWwnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBvdXRwdXQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIFtvbmx5XSBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcykgPHN0cmluZys+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBzdWJqZWN0LFxuICAgICAgICAgICd0byBbb25seV0gaGF2ZSBhdHRyaWJ1dGVzJyxcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IG5vdCB0byBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcykgPGFycmF5PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBhdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhzdWJqZWN0KTtcblxuICAgICAgICB2YWx1ZS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICBkZWxldGUgYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gb25seSBoYXZlIGF0dHJpYnV0ZXMnLCBhdHRyaWJ1dGVzKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gbm90IHRvIGhhdmUgKGF0dHJpYnV0ZXxhdHRyaWJ1dGVzKSA8c3RyaW5nKz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ25vdCB0byBoYXZlIGF0dHJpYnV0ZXMnLFxuICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMilcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gdG8gW29ubHldIGhhdmUgKGF0dHJpYnV0ZXxhdHRyaWJ1dGVzKSA8YXJyYXl8b2JqZWN0PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIHNhdGlzZnknLCB7XG4gICAgICAgICAgYXR0cmlidXRlczogdmFsdWUsXG4gICAgICAgICAgb25seUF0dHJpYnV0ZXM6IGV4cGVjdC5mbGFncy5vbmx5XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gaGF2ZSBubyAoY2hpbGR8Y2hpbGRyZW4pJywgZnVuY3Rpb24oXG4gICAgICBleHBlY3QsXG4gICAgICBzdWJqZWN0XG4gICAgKSB7XG4gICAgICBleHBlY3QuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdWJqZWN0LmNoaWxkTm9kZXMpLFxuICAgICAgICAndG8gYmUgYW4gZW1wdHkgYXJyYXknXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIGhhdmUgKGNoaWxkfGNoaWxkcmVuKScsIGZ1bmN0aW9uKFxuICAgICAgZXhwZWN0LFxuICAgICAgc3ViamVjdFxuICAgICkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LmNoaWxkTm9kZXMsICdub3QgdG8gYmUgZW1wdHknKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIGhhdmUgKGNoaWxkfGNoaWxkcmVuKSA8c3RyaW5nPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHF1ZXJ5KSB7XG4gICAgICAgIGV4cGVjdC5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgZXhwZWN0KHN1YmplY3QucXVlcnlTZWxlY3RvckFsbChxdWVyeSksICdub3QgdG8gYmUgZW1wdHknKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIGhhdmUgdGV4dCA8YW55PicsIGZ1bmN0aW9uKFxuICAgICAgZXhwZWN0LFxuICAgICAgc3ViamVjdCxcbiAgICAgIHZhbHVlXG4gICAgKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QudGV4dENvbnRlbnQsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiBbd2hlbl0gcXVlcmllZCBmb3IgW2ZpcnN0XSA8c3RyaW5nPiA8YXNzZXJ0aW9uPz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSkge1xuICAgICAgICB2YXIgcXVlcnlSZXN1bHQ7XG5cbiAgICAgICAgZXhwZWN0LmFyZ3NPdXRwdXRbMF0gPSBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb3V0cHV0LmdyZWVuKHF1ZXJ5KTtcbiAgICAgICAgfTtcblxuICAgICAgICBleHBlY3QuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG5cbiAgICAgICAgaWYgKGV4cGVjdC5mbGFncy5maXJzdCkge1xuICAgICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHF1ZXJ5KTtcbiAgICAgICAgICBpZiAoIXF1ZXJ5UmVzdWx0KSB7XG4gICAgICAgICAgICBleHBlY3QuZmFpbChmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dFxuICAgICAgICAgICAgICAgIC5lcnJvcignVGhlIHNlbGVjdG9yJylcbiAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgIC5qc1N0cmluZyhxdWVyeSlcbiAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgIC5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcXVlcnlSZXN1bHQgPSBzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpO1xuICAgICAgICAgIGlmIChxdWVyeVJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0XG4gICAgICAgICAgICAgICAgLmVycm9yKCdUaGUgc2VsZWN0b3InKVxuICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgLmpzU3RyaW5nKHF1ZXJ5KVxuICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwZWN0LnNoaWZ0KHF1ZXJ5UmVzdWx0KTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiB0byBjb250YWluIFtub10gZWxlbWVudHMgbWF0Y2hpbmcgPHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSkge1xuICAgICAgICBpZiAoZXhwZWN0LmZsYWdzLm5vKSB7XG4gICAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpLCAndG8gc2F0aXNmeScsIFtdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QucXVlcnlTZWxlY3RvckFsbChxdWVyeSksICdub3QgdG8gc2F0aXNmeScsIFtdKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiBbbm90XSB0byBtYXRjaCA8c3RyaW5nPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHF1ZXJ5KSB7XG4gICAgICAgIHJldHVybiBleHBlY3QoXG4gICAgICAgICAgbWF0Y2hlc1NlbGVjdG9yKHN1YmplY3QsIHF1ZXJ5KSxcbiAgICAgICAgICAndG8gYmUnLFxuICAgICAgICAgICFleHBlY3QuZmxhZ3Mubm90XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPHN0cmluZz4gW3doZW5dIHBhcnNlZCBhcyAoaHRtbHxIVE1MKSBbZnJhZ21lbnRdIDxhc3NlcnRpb24/PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QpIHtcbiAgICAgICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgICByZXR1cm4gZXhwZWN0LnNoaWZ0KFxuICAgICAgICAgIHBhcnNlSHRtbChzdWJqZWN0LCBleHBlY3QuZmxhZ3MuZnJhZ21lbnQsIGV4cGVjdC50ZXN0RGVzY3JpcHRpb24pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPHN0cmluZz4gW3doZW5dIHBhcnNlZCBhcyAoeG1sfFhNTCkgPGFzc2VydGlvbj8+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgICBleHBlY3QuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICAgIHJldHVybiBleHBlY3Quc2hpZnQocGFyc2VYbWwoc3ViamVjdCwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbikpO1xuICAgICAgfVxuICAgICk7XG4gIH1cbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsbSwgc2VsZWN0b3IpIHtcbiAgdmFyIG1hdGNoRnVudGlvbiA9XG4gICAgZWxtLm1hdGNoZXNTZWxlY3RvciB8fFxuICAgIGVsbS5tb3pNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ubXNNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ub01hdGNoZXNTZWxlY3RvciB8fFxuICAgIGVsbS53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBmdW5jdGlvbihzZWxlY3Rvcikge1xuICAgICAgdmFyIG5vZGUgPSB0aGlzO1xuICAgICAgdmFyIG5vZGVzID0gKG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgIHZhciBpID0gMDtcblxuICAgICAgd2hpbGUgKG5vZGVzW2ldICYmIG5vZGVzW2ldICE9PSBub2RlKSB7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuICEhbm9kZXNbaV07XG4gICAgfTtcblxuICByZXR1cm4gbWF0Y2hGdW50aW9uLmNhbGwoZWxtLCBzZWxlY3Rvcik7XG59O1xuIiwidmFyIG9sZFByaXNtR2xvYmFsID0gZ2xvYmFsLlByaXNtO1xudmFyIHByaXNtID0gZ2xvYmFsLlByaXNtID0gcmVxdWlyZSgncHJpc21qcycpO1xucmVxdWlyZSgncHJpc21qcy9jb21wb25lbnRzL3ByaXNtLWdyYXBocWwuanMnKTtcbnJlcXVpcmUoJ3ByaXNtanMvY29tcG9uZW50cy9wcmlzbS1jc3AuanMnKTtcbmdsb2JhbC5QcmlzbSA9IG9sZFByaXNtR2xvYmFsO1xuXG52YXIgZGVmYXVsdFRoZW1lID0ge1xuICAgIC8vIEFkYXB0ZWQgZnJvbSB0aGUgZGVmYXVsdCBQcmlzbSB0aGVtZTpcbiAgICBwcmlzbUNvbW1lbnQ6ICcjNzA4MDkwJywgLy8gc2xhdGVncmF5XG4gICAgcHJpc21Qcm9sb2c6ICdwcmlzbUNvbW1lbnQnLFxuICAgIHByaXNtRG9jdHlwZTogJ3ByaXNtQ29tbWVudCcsXG4gICAgcHJpc21DZGF0YTogJ3ByaXNtQ29tbWVudCcsXG5cbiAgICBwcmlzbVB1bmN0dWF0aW9uOiAnIzk5OScsXG5cbiAgICBwcmlzbVN5bWJvbDogJyM5MDUnLFxuICAgIHByaXNtUHJvcGVydHk6ICdwcmlzbVN5bWJvbCcsXG4gICAgcHJpc21UYWc6ICdwcmlzbVN5bWJvbCcsXG4gICAgcHJpc21Cb29sZWFuOiAncHJpc21TeW1ib2wnLFxuICAgIHByaXNtTnVtYmVyOiAncHJpc21TeW1ib2wnLFxuICAgIHByaXNtQ29uc3RhbnQ6ICdwcmlzbVN5bWJvbCcsXG4gICAgcHJpc21EZWxldGVkOiAncHJpc21TeW1ib2wnLFxuXG4gICAgcHJpc21TdHJpbmc6ICcjNjkwJyxcbiAgICBwcmlzbVNlbGVjdG9yOiAncHJpc21TdHJpbmcnLFxuICAgIHByaXNtQXR0ck5hbWU6ICdwcmlzbVN0cmluZycsXG4gICAgcHJpc21DaGFyOiAncHJpc21TdHJpbmcnLFxuICAgIHByaXNtQnVpbHRpbjogJ3ByaXNtU3RyaW5nJyxcbiAgICBwcmlzbUluc2VydGVkOiAncHJpc21TdHJpbmcnLFxuXG4gICAgcHJpc21PcGVyYXRvcjogJyNhNjdmNTknLFxuICAgIHByaXNtVmFyaWFibGU6ICdwcmlzbU9wZXJhdG9yJyxcbiAgICBwcmlzbUVudGl0eTogJ3ByaXNtT3BlcmF0b3InLFxuICAgIHByaXNtVXJsOiAncHJpc21PcGVyYXRvcicsXG4gICAgcHJpc21Dc3NTdHJpbmc6ICdwcmlzbU9wZXJhdG9yJyxcblxuICAgIHByaXNtS2V5d29yZDogJyMwN2EnLFxuICAgIHByaXNtQXRydWxlOiAncHJpc21LZXl3b3JkJyxcbiAgICBwcmlzbUF0dHJWYWx1ZTogJ3ByaXNtS2V5d29yZCcsXG5cbiAgICBwcmlzbUZ1bmN0aW9uOiAnI0RENEE2OCcsXG5cbiAgICBwcmlzbVJlZ2V4OiAnI2U5MCcsXG4gICAgcHJpc21JbXBvcnRhbnQ6IFsnI2U5MCcsICdib2xkJ11cbn07XG5cbnZhciBsYW5ndWFnZU1hcHBpbmcgPSB7XG4gICAgJ3RleHQvaHRtbCc6ICdtYXJrdXAnLFxuICAgICdhcHBsaWNhdGlvbi94bWwnOiAnbWFya3VwJyxcbiAgICAndGV4dC94bWwnOiAnbWFya3VwJyxcbiAgICAnYXBwbGljYXRpb24vanNvbic6ICdqYXZhc2NyaXB0JyxcbiAgICAndGV4dC9qYXZhc2NyaXB0JzogJ2phdmFzY3JpcHQnLFxuICAgICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogJ2phdmFzY3JpcHQnLFxuICAgICd0ZXh0L2Nzcyc6ICdjc3MnLFxuICAgIGh0bWw6ICdtYXJrdXAnLFxuICAgIHhtbDogJ21hcmt1cCcsXG4gICAgYzogJ2NsaWtlJyxcbiAgICAnYysrJzogJ2NsaWtlJyxcbiAgICAnY3BwJzogJ2NsaWtlJyxcbiAgICAnYyMnOiAnY2xpa2UnLFxuICAgIGphdmE6ICdjbGlrZScsXG4gICAgJ2FwcGxpY2F0aW9uL2dyYXBocWwnOiAnZ3JhcGhxbCdcbn07XG5cbmZ1bmN0aW9uIHVwcGVyQ2FtZWxDYXNlKHN0cikge1xuICAgIHJldHVybiBzdHIucmVwbGFjZSgvKD86XnwtKShbYS16XSkvZywgZnVuY3Rpb24gKCQwLCBjaCkge1xuICAgICAgICByZXR1cm4gY2gudG9VcHBlckNhc2UoKTtcbiAgICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgbmFtZTogJ21hZ2ljcGVuLXByaXNtJyxcbiAgICB2ZXJzaW9uOiByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICAgIGluc3RhbGxJbnRvOiBmdW5jdGlvbiAobWFnaWNQZW4pIHtcbiAgICAgICAgbWFnaWNQZW4uaW5zdGFsbFRoZW1lKGRlZmF1bHRUaGVtZSk7XG5cbiAgICAgICAgbWFnaWNQZW4uYWRkU3R5bGUoJ2NvZGUnLCBmdW5jdGlvbiAoc291cmNlVGV4dCwgbGFuZ3VhZ2UpIHtcbiAgICAgICAgICAgIGlmIChsYW5ndWFnZSBpbiBsYW5ndWFnZU1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZSA9IGxhbmd1YWdlTWFwcGluZ1tsYW5ndWFnZV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9cXCt4bWxcXGIvLnRlc3QobGFuZ3VhZ2UpKSB7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2UgPSAnbWFya3VwJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGxhbmd1YWdlIGluIHByaXNtLmxhbmd1YWdlcykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50ZXh0KHNvdXJjZVRleHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgY2FwaXRhbGl6ZWRMYW5ndWFnZSA9IHVwcGVyQ2FtZWxDYXNlKGxhbmd1YWdlKTtcbiAgICAgICAgICAgIHZhciBsYW5ndWFnZURlZmluaXRpb24gPSBwcmlzbS5sYW5ndWFnZXNbbGFuZ3VhZ2VdO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBwcmludFRva2Vucyh0b2tlbiwgcGFyZW50U3R5bGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0b2tlbikpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4uZm9yRWFjaChmdW5jdGlvbiAoc3ViVG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW50VG9rZW5zKHN1YlRva2VuLCBwYXJlbnRTdHlsZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGUgPSB1cHBlckNhbWVsQ2FzZShwYXJlbnRTdHlsZSk7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuID0gdG9rZW4ucmVwbGFjZSgvJmx0Oy9nLCAnPCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdFsncHJpc20nICsgY2FwaXRhbGl6ZWRMYW5ndWFnZSArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdFsncHJpc20nICsgY2FwaXRhbGl6ZWRMYW5ndWFnZSArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSh0b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhhdFsncHJpc20nICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0WydwcmlzbScgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0odG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxhbmd1YWdlRGVmaW5pdGlvbltwYXJlbnRTdHlsZV0gJiYgbGFuZ3VhZ2VEZWZpbml0aW9uW3BhcmVudFN0eWxlXS5hbGlhcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRUb2tlbnModG9rZW4sIGxhbmd1YWdlRGVmaW5pdGlvbltwYXJlbnRTdHlsZV0uYWxpYXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50ZXh0KHRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByaW50VG9rZW5zKHRva2VuLmNvbnRlbnQsIHRva2VuLnR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByaW50VG9rZW5zKHByaXNtLnRva2VuaXplKHNvdXJjZVRleHQsIHByaXNtLmxhbmd1YWdlc1tsYW5ndWFnZV0pLCAndGV4dCcpO1xuICAgICAgICB9LCB0cnVlKTtcbiAgICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIl9mcm9tXCI6IFwibWFnaWNwZW4tcHJpc21AXjIuMy4wXCIsXG4gIFwiX2lkXCI6IFwibWFnaWNwZW4tcHJpc21AMi40LjBcIixcbiAgXCJfaW5CdW5kbGVcIjogZmFsc2UsXG4gIFwiX2ludGVncml0eVwiOiBcInNoYTUxMi1PRUZaK3hrc0p0WWd3blU1akpxRFhoanZnblNGZk1zU2dYcEoyV1dQYUJKVVhOS3VRQjBGQkFpUXhqUktzVjVnbnRwZy90YXpIOEwzYXBKeDVlTWRKZz09XCIsXG4gIFwiX2xvY2F0aW9uXCI6IFwiL21hZ2ljcGVuLXByaXNtXCIsXG4gIFwiX3BoYW50b21DaGlsZHJlblwiOiB7fSxcbiAgXCJfcmVxdWVzdGVkXCI6IHtcbiAgICBcInR5cGVcIjogXCJyYW5nZVwiLFxuICAgIFwicmVnaXN0cnlcIjogdHJ1ZSxcbiAgICBcInJhd1wiOiBcIm1hZ2ljcGVuLXByaXNtQF4yLjMuMFwiLFxuICAgIFwibmFtZVwiOiBcIm1hZ2ljcGVuLXByaXNtXCIsXG4gICAgXCJlc2NhcGVkTmFtZVwiOiBcIm1hZ2ljcGVuLXByaXNtXCIsXG4gICAgXCJyYXdTcGVjXCI6IFwiXjIuMy4wXCIsXG4gICAgXCJzYXZlU3BlY1wiOiBudWxsLFxuICAgIFwiZmV0Y2hTcGVjXCI6IFwiXjIuMy4wXCJcbiAgfSxcbiAgXCJfcmVxdWlyZWRCeVwiOiBbXG4gICAgXCIvXCJcbiAgXSxcbiAgXCJfcmVzb2x2ZWRcIjogXCJodHRwczovL3JlZ2lzdHJ5Lm5wbWpzLm9yZy9tYWdpY3Blbi1wcmlzbS8tL21hZ2ljcGVuLXByaXNtLTIuNC4wLnRnelwiLFxuICBcIl9zaGFzdW1cIjogXCJhYTc5Y2E5YjY1NmYzNTA2OWFkMGFlYThiMTAyZjFhYzg2NDJjYmIwXCIsXG4gIFwiX3NwZWNcIjogXCJtYWdpY3Blbi1wcmlzbUBeMi4zLjBcIixcbiAgXCJfd2hlcmVcIjogXCIvVXNlcnMvc3NpbW9uc2VuL0NvZGUvdW5leHBlY3RlZC1kb21cIixcbiAgXCJhdXRob3JcIjoge1xuICAgIFwibmFtZVwiOiBcIkFuZHJlYXMgTGluZFwiLFxuICAgIFwiZW1haWxcIjogXCJhbmRyZWFzQG9uZS5jb21cIlxuICB9LFxuICBcImJ1Z3NcIjoge1xuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3VuZXhwZWN0ZWRqcy9tYWdpY3Blbi1wcmlzbS9pc3N1ZXNcIlxuICB9LFxuICBcImJ1bmRsZURlcGVuZGVuY2llc1wiOiBmYWxzZSxcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwicHJpc21qc1wiOiBcIjEuMTEuMFwiXG4gIH0sXG4gIFwiZGVwcmVjYXRlZFwiOiBmYWxzZSxcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkFkZCBzeW50YXggaGlnaGxpZ2h0aW5nIHN1cHBvcnQgdG8gbWFnaWNwZW4gdmlhIHByaXNtLmpzXCIsXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCIxMy4wLjBcIixcbiAgICBcImJ1bmRsZS1jb2xsYXBzZXJcIjogXCIxLjIuMVwiLFxuICAgIFwiZXNsaW50XCI6IFwiMi4xMy4xXCIsXG4gICAgXCJlc2xpbnQtY29uZmlnLW9uZWxpbnRcIjogXCIxLjIuMFwiLFxuICAgIFwibWFnaWNwZW5cIjogXCI1LjkuMFwiLFxuICAgIFwibW9jaGFcIjogXCIyLjQuNVwiLFxuICAgIFwidW5leHBlY3RlZFwiOiBcIjEwLjEwLjVcIlxuICB9LFxuICBcImZpbGVzXCI6IFtcbiAgICBcImxpYlwiLFxuICAgIFwibWFnaWNQZW5QcmlzbS5taW4uanNcIlxuICBdLFxuICBcImhvbWVwYWdlXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3VuZXhwZWN0ZWRqcy9tYWdpY3Blbi1wcmlzbSNyZWFkbWVcIixcbiAgXCJtYWluXCI6IFwibGliL21hZ2ljUGVuUHJpc20uanNcIixcbiAgXCJuYW1lXCI6IFwibWFnaWNwZW4tcHJpc21cIixcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImdpdCtodHRwczovL2dpdGh1Yi5jb20vdW5leHBlY3RlZGpzL21hZ2ljcGVuLXByaXNtLmdpdFwiXG4gIH0sXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJsaW50XCI6IFwiZXNsaW50IC5cIixcbiAgICBcInByZXB1Ymxpc2hcIjogXCJicm93c2VyaWZ5IC1wIGJ1bmRsZS1jb2xsYXBzZXIvcGx1Z2luIC1lIGxpYi9tYWdpY1BlblByaXNtIC1zIG1hZ2ljUGVuUHJpc20gPiBtYWdpY1BlblByaXNtLm1pbi5qc1wiLFxuICAgIFwidGVzdFwiOiBcIm1vY2hhXCIsXG4gICAgXCJ0cmF2aXNcIjogXCJucG0gcnVuIGxpbnQgJiYgbnBtIHRlc3RcIlxuICB9LFxuICBcInZlcnNpb25cIjogXCIyLjQuMFwiXG59XG4iLCIvKipcbiAqIE9yaWdpbmFsIGJ5IFNjb3R0IEhlbG1lLlxuICpcbiAqIFJlZmVyZW5jZTogaHR0cHM6Ly9zY290dGhlbG1lLmNvLnVrL2NzcC1jaGVhdC1zaGVldC9cbiAqXG4gKiBTdXBwb3J0cyB0aGUgZm9sbG93aW5nOlxuICogIC0gQ1NQIExldmVsIDFcbiAqICAtIENTUCBMZXZlbCAyXG4gKiAgLSBDU1AgTGV2ZWwgM1xuICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3AgPSB7XG5cdCdkaXJlY3RpdmUnOiAge1xuICAgICAgICAgICAgIHBhdHRlcm46IC9cXGIoPzooPzpiYXNlLXVyaXxmb3JtLWFjdGlvbnxmcmFtZS1hbmNlc3RvcnN8cGx1Z2luLXR5cGVzfHJlZmVycmVyfHJlZmxlY3RlZC14c3N8cmVwb3J0LXRvfHJlcG9ydC11cml8cmVxdWlyZS1zcmktZm9yfHNhbmRib3gpIHwoPzpibG9jay1hbGwtbWl4ZWQtY29udGVudHxkaXNvd24tb3BlbmVyfHVwZ3JhZGUtaW5zZWN1cmUtcmVxdWVzdHMpKD86IHw7KXwoPzpjaGlsZHxjb25uZWN0fGRlZmF1bHR8Zm9udHxmcmFtZXxpbWd8bWFuaWZlc3R8bWVkaWF8b2JqZWN0fHNjcmlwdHxzdHlsZXx3b3JrZXIpLXNyYyApL2ksXG4gICAgICAgICAgICAgYWxpYXM6ICdrZXl3b3JkJ1xuICAgICAgICB9LFxuXHQnc2FmZSc6IHtcbiAgICAgICAgICAgIHBhdHRlcm46IC8nKD86c2VsZnxub25lfHN0cmljdC1keW5hbWljfCg/Om5vbmNlLXxzaGEoPzoyNTZ8Mzg0fDUxMiktKVthLXpBLVowLTkrPS9dKyknLyxcbiAgICAgICAgICAgIGFsaWFzOiAnc2VsZWN0b3InXG4gICAgICAgIH0sXG5cdCd1bnNhZmUnOiB7XG4gICAgICAgICAgICBwYXR0ZXJuOiAvKD86J3Vuc2FmZS1pbmxpbmUnfCd1bnNhZmUtZXZhbCd8J3Vuc2FmZS1oYXNoZWQtYXR0cmlidXRlcyd8XFwqKS8sXG4gICAgICAgICAgICBhbGlhczogJ2Z1bmN0aW9uJ1xuICAgICAgICB9XG59OyIsIlByaXNtLmxhbmd1YWdlcy5ncmFwaHFsID0ge1xuXHQnY29tbWVudCc6IC8jLiovLFxuXHQnc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC9cIig/OlxcXFwufFteXFxcXFwiXFxyXFxuXSkqXCIvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQnbnVtYmVyJzogLyg/OlxcQi18XFxiKVxcZCsoPzpcXC5cXGQrKT8oPzpbZUVdWystXT9cXGQrKT9cXGIvLFxuXHQnYm9vbGVhbic6IC9cXGIoPzp0cnVlfGZhbHNlKVxcYi8sXG5cdCd2YXJpYWJsZSc6IC9cXCRbYS16X11cXHcqL2ksXG5cdCdkaXJlY3RpdmUnOiB7XG5cdFx0cGF0dGVybjogL0BbYS16X11cXHcqL2ksXG5cdFx0YWxpYXM6ICdmdW5jdGlvbidcblx0fSxcblx0J2F0dHItbmFtZSc6IC9bYS16X11cXHcqKD89XFxzKjopL2ksXG5cdCdrZXl3b3JkJzogW1xuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oZnJhZ21lbnRcXHMrKD8hb24pW2Etel9dXFx3Klxccyt8XFwuezN9XFxzKilvblxcYi8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fSxcblx0XHQvXFxiKD86cXVlcnl8ZnJhZ21lbnR8bXV0YXRpb24pXFxiL1xuXHRdLFxuXHQnb3BlcmF0b3InOiAvIXw9fFxcLnszfS8sXG5cdCdwdW5jdHVhdGlvbic6IC9bISgpe31cXFtcXF06PSxdL1xufTsiLCJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXG5cdD8gd2luZG93ICAgLy8gaWYgaW4gYnJvd3NlclxuXHQ6IChcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXG5cdFx0PyBzZWxmIC8vIGlmIGluIHdvcmtlclxuXHRcdDoge30gICAvLyBpZiBpbiBub2RlIGpzXG5cdCk7XG5cbi8qKlxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xuICogTUlUIGxpY2Vuc2UgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHAvXG4gKiBAYXV0aG9yIExlYSBWZXJvdSBodHRwOi8vbGVhLnZlcm91Lm1lXG4gKi9cblxudmFyIFByaXNtID0gKGZ1bmN0aW9uKCl7XG5cbi8vIFByaXZhdGUgaGVscGVyIHZhcnNcbnZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKFxcdyspXFxiL2k7XG52YXIgdW5pcXVlSWQgPSAwO1xuXG52YXIgXyA9IF9zZWxmLlByaXNtID0ge1xuXHRtYW51YWw6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLm1hbnVhbCxcblx0ZGlzYWJsZVdvcmtlck1lc3NhZ2VIYW5kbGVyOiBfc2VsZi5QcmlzbSAmJiBfc2VsZi5QcmlzbS5kaXNhYmxlV29ya2VyTWVzc2FnZUhhbmRsZXIsXG5cdHV0aWw6IHtcblx0XHRlbmNvZGU6IGZ1bmN0aW9uICh0b2tlbnMpIHtcblx0XHRcdGlmICh0b2tlbnMgaW5zdGFuY2VvZiBUb2tlbikge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFRva2VuKHRva2Vucy50eXBlLCBfLnV0aWwuZW5jb2RlKHRva2Vucy5jb250ZW50KSwgdG9rZW5zLmFsaWFzKTtcblx0XHRcdH0gZWxzZSBpZiAoXy51dGlsLnR5cGUodG9rZW5zKSA9PT0gJ0FycmF5Jykge1xuXHRcdFx0XHRyZXR1cm4gdG9rZW5zLm1hcChfLnV0aWwuZW5jb2RlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHR0eXBlOiBmdW5jdGlvbiAobykge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5tYXRjaCgvXFxbb2JqZWN0IChcXHcrKVxcXS8pWzFdO1xuXHRcdH0sXG5cblx0XHRvYmpJZDogZnVuY3Rpb24gKG9iaikge1xuXHRcdFx0aWYgKCFvYmpbJ19faWQnXSkge1xuXHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCAnX19pZCcsIHsgdmFsdWU6ICsrdW5pcXVlSWQgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gb2JqWydfX2lkJ107XG5cdFx0fSxcblxuXHRcdC8vIERlZXAgY2xvbmUgYSBsYW5ndWFnZSBkZWZpbml0aW9uIChlLmcuIHRvIGV4dGVuZCBpdClcblx0XHRjbG9uZTogZnVuY3Rpb24gKG8pIHtcblx0XHRcdHZhciB0eXBlID0gXy51dGlsLnR5cGUobyk7XG5cblx0XHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0XHRjYXNlICdPYmplY3QnOlxuXHRcdFx0XHRcdHZhciBjbG9uZSA9IHt9O1xuXG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIG8pIHtcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmVba2V5XSA9IF8udXRpbC5jbG9uZShvW2tleV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBjbG9uZTtcblxuXHRcdFx0XHRjYXNlICdBcnJheSc6XG5cdFx0XHRcdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIF8udXRpbC5jbG9uZSh2KTsgfSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBvO1xuXHRcdH1cblx0fSxcblxuXHRsYW5ndWFnZXM6IHtcblx0XHRleHRlbmQ6IGZ1bmN0aW9uIChpZCwgcmVkZWYpIHtcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XG5cblx0XHRcdGZvciAodmFyIGtleSBpbiByZWRlZikge1xuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbGFuZztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0ICogSW5zZXJ0IGEgdG9rZW4gYmVmb3JlIGFub3RoZXIgdG9rZW4gaW4gYSBsYW5ndWFnZSBsaXRlcmFsXG5cdFx0ICogQXMgdGhpcyBuZWVkcyB0byByZWNyZWF0ZSB0aGUgb2JqZWN0ICh3ZSBjYW5ub3QgYWN0dWFsbHkgaW5zZXJ0IGJlZm9yZSBrZXlzIGluIG9iamVjdCBsaXRlcmFscyksXG5cdFx0ICogd2UgY2Fubm90IGp1c3QgcHJvdmlkZSBhbiBvYmplY3QsIHdlIG5lZWQgYW5vYmplY3QgYW5kIGEga2V5LlxuXHRcdCAqIEBwYXJhbSBpbnNpZGUgVGhlIGtleSAob3IgbGFuZ3VhZ2UgaWQpIG9mIHRoZSBwYXJlbnRcblx0XHQgKiBAcGFyYW0gYmVmb3JlIFRoZSBrZXkgdG8gaW5zZXJ0IGJlZm9yZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgZnVuY3Rpb24gYXBwZW5kcyBpbnN0ZWFkLlxuXHRcdCAqIEBwYXJhbSBpbnNlcnQgT2JqZWN0IHdpdGggdGhlIGtleS92YWx1ZSBwYWlycyB0byBpbnNlcnRcblx0XHQgKiBAcGFyYW0gcm9vdCBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgYGluc2lkZWAuIElmIGVxdWFsIHRvIFByaXNtLmxhbmd1YWdlcywgaXQgY2FuIGJlIG9taXR0ZWQuXG5cdFx0ICovXG5cdFx0aW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiAoaW5zaWRlLCBiZWZvcmUsIGluc2VydCwgcm9vdCkge1xuXHRcdFx0cm9vdCA9IHJvb3QgfHwgXy5sYW5ndWFnZXM7XG5cdFx0XHR2YXIgZ3JhbW1hciA9IHJvb3RbaW5zaWRlXTtcblxuXHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMikge1xuXHRcdFx0XHRpbnNlcnQgPSBhcmd1bWVudHNbMV07XG5cblx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdGdyYW1tYXJbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZ3JhbW1hcjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHJldCA9IHt9O1xuXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XG5cblx0XHRcdFx0aWYgKGdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pKSB7XG5cblx0XHRcdFx0XHRpZiAodG9rZW4gPT0gYmVmb3JlKSB7XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xuXG5cdFx0XHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXRbdG9rZW5dID0gZ3JhbW1hclt0b2tlbl07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gVXBkYXRlIHJlZmVyZW5jZXMgaW4gb3RoZXIgbGFuZ3VhZ2UgZGVmaW5pdGlvbnNcblx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhfLmxhbmd1YWdlcywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRcdFx0XHRpZiAodmFsdWUgPT09IHJvb3RbaW5zaWRlXSAmJiBrZXkgIT0gaW5zaWRlKSB7XG5cdFx0XHRcdFx0dGhpc1trZXldID0gcmV0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHJvb3RbaW5zaWRlXSA9IHJldDtcblx0XHR9LFxuXG5cdFx0Ly8gVHJhdmVyc2UgYSBsYW5ndWFnZSBkZWZpbml0aW9uIHdpdGggRGVwdGggRmlyc3QgU2VhcmNoXG5cdFx0REZTOiBmdW5jdGlvbihvLCBjYWxsYmFjaywgdHlwZSwgdmlzaXRlZCkge1xuXHRcdFx0dmlzaXRlZCA9IHZpc2l0ZWQgfHwge307XG5cdFx0XHRmb3IgKHZhciBpIGluIG8pIHtcblx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoaSkpIHtcblx0XHRcdFx0XHRjYWxsYmFjay5jYWxsKG8sIGksIG9baV0sIHR5cGUgfHwgaSk7XG5cblx0XHRcdFx0XHRpZiAoXy51dGlsLnR5cGUob1tpXSkgPT09ICdPYmplY3QnICYmICF2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIG51bGwsIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ0FycmF5JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XG5cdFx0XHRcdFx0XHR2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0Xy5sYW5ndWFnZXMuREZTKG9baV0sIGNhbGxiYWNrLCBpLCB2aXNpdGVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdHBsdWdpbnM6IHt9LFxuXG5cdGhpZ2hsaWdodEFsbDogZnVuY3Rpb24oYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Xy5oaWdobGlnaHRBbGxVbmRlcihkb2N1bWVudCwgYXN5bmMsIGNhbGxiYWNrKTtcblx0fSxcblxuXHRoaWdobGlnaHRBbGxVbmRlcjogZnVuY3Rpb24oY29udGFpbmVyLCBhc3luYywgY2FsbGJhY2spIHtcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XG5cblx0XHR2YXIgZWxlbWVudHMgPSBlbnYuZWxlbWVudHMgfHwgY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoZW52LnNlbGVjdG9yKTtcblxuXHRcdGZvciAodmFyIGk9MCwgZWxlbWVudDsgZWxlbWVudCA9IGVsZW1lbnRzW2krK107KSB7XG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGVudi5jYWxsYmFjayk7XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdC8vIEZpbmQgbGFuZ3VhZ2Vcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XG5cblx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdH1cblxuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdGxhbmd1YWdlID0gKHBhcmVudC5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywnJ10pWzFdLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRncmFtbWFyID0gXy5sYW5ndWFnZXNbbGFuZ3VhZ2VdO1xuXHRcdH1cblxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgZWxlbWVudCwgaWYgbm90IHByZXNlbnRcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXG5cdFx0aWYgKGVsZW1lbnQucGFyZW50Tm9kZSkge1xuXHRcdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBwYXJlbnQsIGZvciBzdHlsaW5nXG5cdFx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cblx0XHRcdGlmICgvcHJlL2kudGVzdChwYXJlbnQubm9kZU5hbWUpKSB7XG5cdFx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcblxuXHRcdHZhciBlbnYgPSB7XG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxuXHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdFx0Z3JhbW1hcjogZ3JhbW1hcixcblx0XHRcdGNvZGU6IGNvZGVcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1zYW5pdHktY2hlY2snLCBlbnYpO1xuXG5cdFx0aWYgKCFlbnYuY29kZSB8fCAhZW52LmdyYW1tYXIpIHtcblx0XHRcdGlmIChlbnYuY29kZSkge1xuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRcdGVudi5lbGVtZW50LnRleHRDb250ZW50ID0gZW52LmNvZGU7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0fVxuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XG5cblx0XHRpZiAoYXN5bmMgJiYgX3NlbGYuV29ya2VyKSB7XG5cdFx0XHR2YXIgd29ya2VyID0gbmV3IFdvcmtlcihfLmZpbGVuYW1lKTtcblxuXHRcdFx0d29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gZXZ0LmRhdGE7XG5cblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1pbnNlcnQnLCBlbnYpO1xuXG5cdFx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0fTtcblxuXHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcblx0XHRcdFx0Y29kZTogZW52LmNvZGUsXG5cdFx0XHRcdGltbWVkaWF0ZUNsb3NlOiB0cnVlXG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IF8uaGlnaGxpZ2h0KGVudi5jb2RlLCBlbnYuZ3JhbW1hciwgZW52Lmxhbmd1YWdlKTtcblxuXHRcdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1pbnNlcnQnLCBlbnYpO1xuXG5cdFx0XHRlbnYuZWxlbWVudC5pbm5lckhUTUwgPSBlbnYuaGlnaGxpZ2h0ZWRDb2RlO1xuXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVsZW1lbnQpO1xuXG5cdFx0XHRfLmhvb2tzLnJ1bignYWZ0ZXItaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodDogZnVuY3Rpb24gKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0dmFyIHRva2VucyA9IF8udG9rZW5pemUodGV4dCwgZ3JhbW1hcik7XG5cdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShfLnV0aWwuZW5jb2RlKHRva2VucyksIGxhbmd1YWdlKTtcblx0fSxcblxuXHRtYXRjaEdyYW1tYXI6IGZ1bmN0aW9uICh0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIGluZGV4LCBzdGFydFBvcywgb25lc2hvdCwgdGFyZ2V0KSB7XG5cdFx0dmFyIFRva2VuID0gXy5Ub2tlbjtcblxuXHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblx0XHRcdGlmKCFncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSB8fCAhZ3JhbW1hclt0b2tlbl0pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0b2tlbiA9PSB0YXJnZXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcGF0dGVybnMgPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdHBhdHRlcm5zID0gKF8udXRpbC50eXBlKHBhdHRlcm5zKSA9PT0gXCJBcnJheVwiKSA/IHBhdHRlcm5zIDogW3BhdHRlcm5zXTtcblxuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwYXR0ZXJucy5sZW5ndGg7ICsraikge1xuXHRcdFx0XHR2YXIgcGF0dGVybiA9IHBhdHRlcm5zW2pdLFxuXHRcdFx0XHRcdGluc2lkZSA9IHBhdHRlcm4uaW5zaWRlLFxuXHRcdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcblx0XHRcdFx0XHRncmVlZHkgPSAhIXBhdHRlcm4uZ3JlZWR5LFxuXHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSAwLFxuXHRcdFx0XHRcdGFsaWFzID0gcGF0dGVybi5hbGlhcztcblxuXHRcdFx0XHRpZiAoZ3JlZWR5ICYmICFwYXR0ZXJuLnBhdHRlcm4uZ2xvYmFsKSB7XG5cdFx0XHRcdFx0Ly8gV2l0aG91dCB0aGUgZ2xvYmFsIGZsYWcsIGxhc3RJbmRleCB3b24ndCB3b3JrXG5cdFx0XHRcdFx0dmFyIGZsYWdzID0gcGF0dGVybi5wYXR0ZXJuLnRvU3RyaW5nKCkubWF0Y2goL1tpbXV5XSokLylbMF07XG5cdFx0XHRcdFx0cGF0dGVybi5wYXR0ZXJuID0gUmVnRXhwKHBhdHRlcm4ucGF0dGVybi5zb3VyY2UsIGZsYWdzICsgXCJnXCIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybiB8fCBwYXR0ZXJuO1xuXG5cdFx0XHRcdC8vIERvbuKAmXQgY2FjaGUgbGVuZ3RoIGFzIGl0IGNoYW5nZXMgZHVyaW5nIHRoZSBsb29wXG5cdFx0XHRcdGZvciAodmFyIGkgPSBpbmRleCwgcG9zID0gc3RhcnRQb3M7IGkgPCBzdHJhcnIubGVuZ3RoOyBwb3MgKz0gc3RyYXJyW2ldLmxlbmd0aCwgKytpKSB7XG5cblx0XHRcdFx0XHR2YXIgc3RyID0gc3RyYXJyW2ldO1xuXG5cdFx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Ly8gU29tZXRoaW5nIHdlbnQgdGVycmlibHkgd3JvbmcsIEFCT1JULCBBQk9SVCFcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoc3RyIGluc3RhbmNlb2YgVG9rZW4pIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gMDtcblxuXHRcdFx0XHRcdHZhciBtYXRjaCA9IHBhdHRlcm4uZXhlYyhzdHIpLFxuXHRcdFx0XHRcdCAgICBkZWxOdW0gPSAxO1xuXG5cdFx0XHRcdFx0Ly8gR3JlZWR5IHBhdHRlcm5zIGNhbiBvdmVycmlkZS9yZW1vdmUgdXAgdG8gdHdvIHByZXZpb3VzbHkgbWF0Y2hlZCB0b2tlbnNcblx0XHRcdFx0XHRpZiAoIW1hdGNoICYmIGdyZWVkeSAmJiBpICE9IHN0cmFyci5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IHBvcztcblx0XHRcdFx0XHRcdG1hdGNoID0gcGF0dGVybi5leGVjKHRleHQpO1xuXHRcdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCArIChsb29rYmVoaW5kID8gbWF0Y2hbMV0ubGVuZ3RoIDogMCksXG5cdFx0XHRcdFx0XHQgICAgdG8gPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCxcblx0XHRcdFx0XHRcdCAgICBrID0gaSxcblx0XHRcdFx0XHRcdCAgICBwID0gcG9zO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBsZW4gPSBzdHJhcnIubGVuZ3RoOyBrIDwgbGVuICYmIChwIDwgdG8gfHwgKCFzdHJhcnJba10udHlwZSAmJiAhc3RyYXJyW2sgLSAxXS5ncmVlZHkpKTsgKytrKSB7XG5cdFx0XHRcdFx0XHRcdHAgKz0gc3RyYXJyW2tdLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Ly8gTW92ZSB0aGUgaW5kZXggaSB0byB0aGUgZWxlbWVudCBpbiBzdHJhcnIgdGhhdCBpcyBjbG9zZXN0IHRvIGZyb21cblx0XHRcdFx0XHRcdFx0aWYgKGZyb20gPj0gcCkge1xuXHRcdFx0XHRcdFx0XHRcdCsraTtcblx0XHRcdFx0XHRcdFx0XHRwb3MgPSBwO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8qXG5cdFx0XHRcdFx0XHQgKiBJZiBzdHJhcnJbaV0gaXMgYSBUb2tlbiwgdGhlbiB0aGUgbWF0Y2ggc3RhcnRzIGluc2lkZSBhbm90aGVyIFRva2VuLCB3aGljaCBpcyBpbnZhbGlkXG5cdFx0XHRcdFx0XHQgKiBJZiBzdHJhcnJbayAtIDFdIGlzIGdyZWVkeSB3ZSBhcmUgaW4gY29uZmxpY3Qgd2l0aCBhbm90aGVyIGdyZWVkeSBwYXR0ZXJuXG5cdFx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRcdGlmIChzdHJhcnJbaV0gaW5zdGFuY2VvZiBUb2tlbiB8fCBzdHJhcnJbayAtIDFdLmdyZWVkeSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gTnVtYmVyIG9mIHRva2VucyB0byBkZWxldGUgYW5kIHJlcGxhY2Ugd2l0aCB0aGUgbmV3IG1hdGNoXG5cdFx0XHRcdFx0XHRkZWxOdW0gPSBrIC0gaTtcblx0XHRcdFx0XHRcdHN0ciA9IHRleHQuc2xpY2UocG9zLCBwKTtcblx0XHRcdFx0XHRcdG1hdGNoLmluZGV4IC09IHBvcztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRcdFx0XHRpZiAob25lc2hvdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYobG9va2JlaGluZCkge1xuXHRcdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IG1hdGNoWzFdLmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgbG9va2JlaGluZExlbmd0aCxcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcblx0XHRcdFx0XHQgICAgdG8gPSBmcm9tICsgbWF0Y2gubGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBiZWZvcmUgPSBzdHIuc2xpY2UoMCwgZnJvbSksXG5cdFx0XHRcdFx0ICAgIGFmdGVyID0gc3RyLnNsaWNlKHRvKTtcblxuXHRcdFx0XHRcdHZhciBhcmdzID0gW2ksIGRlbE51bV07XG5cblx0XHRcdFx0XHRpZiAoYmVmb3JlKSB7XG5cdFx0XHRcdFx0XHQrK2k7XG5cdFx0XHRcdFx0XHRwb3MgKz0gYmVmb3JlLmxlbmd0aDtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChiZWZvcmUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciB3cmFwcGVkID0gbmV3IFRva2VuKHRva2VuLCBpbnNpZGU/IF8udG9rZW5pemUobWF0Y2gsIGluc2lkZSkgOiBtYXRjaCwgYWxpYXMsIG1hdGNoLCBncmVlZHkpO1xuXG5cdFx0XHRcdFx0YXJncy5wdXNoKHdyYXBwZWQpO1xuXG5cdFx0XHRcdFx0aWYgKGFmdGVyKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkoc3RyYXJyLCBhcmdzKTtcblxuXHRcdFx0XHRcdGlmIChkZWxOdW0gIT0gMSlcblx0XHRcdFx0XHRcdF8ubWF0Y2hHcmFtbWFyKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaSwgcG9zLCB0cnVlLCB0b2tlbik7XG5cblx0XHRcdFx0XHRpZiAob25lc2hvdClcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xuXHRcdHZhciBzdHJhcnIgPSBbdGV4dF07XG5cblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcblxuXHRcdGlmIChyZXN0KSB7XG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiByZXN0KSB7XG5cdFx0XHRcdGdyYW1tYXJbdG9rZW5dID0gcmVzdFt0b2tlbl07XG5cdFx0XHR9XG5cblx0XHRcdGRlbGV0ZSBncmFtbWFyLnJlc3Q7XG5cdFx0fVxuXG5cdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCAwLCAwLCBmYWxzZSk7XG5cblx0XHRyZXR1cm4gc3RyYXJyO1xuXHR9LFxuXG5cdGhvb2tzOiB7XG5cdFx0YWxsOiB7fSxcblxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgaG9va3MgPSBfLmhvb2tzLmFsbDtcblxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcblxuXHRcdFx0aG9va3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdFx0fSxcblxuXHRcdHJ1bjogZnVuY3Rpb24gKG5hbWUsIGVudikge1xuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xuXG5cdFx0XHRpZiAoIWNhbGxiYWNrcyB8fCAhY2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XG5cdFx0XHRcdGNhbGxiYWNrKGVudik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG52YXIgVG9rZW4gPSBfLlRva2VuID0gZnVuY3Rpb24odHlwZSwgY29udGVudCwgYWxpYXMsIG1hdGNoZWRTdHIsIGdyZWVkeSkge1xuXHR0aGlzLnR5cGUgPSB0eXBlO1xuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xuXHR0aGlzLmFsaWFzID0gYWxpYXM7XG5cdC8vIENvcHkgb2YgdGhlIGZ1bGwgc3RyaW5nIHRoaXMgdG9rZW4gd2FzIGNyZWF0ZWQgZnJvbVxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xuXHR0aGlzLmdyZWVkeSA9ICEhZ3JlZWR5O1xufTtcblxuVG9rZW4uc3RyaW5naWZ5ID0gZnVuY3Rpb24obywgbGFuZ3VhZ2UsIHBhcmVudCkge1xuXHRpZiAodHlwZW9mIG8gPT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gbztcblx0fVxuXG5cdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ0FycmF5Jykge1xuXHRcdHJldHVybiBvLm1hcChmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KGVsZW1lbnQsIGxhbmd1YWdlLCBvKTtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdHZhciBlbnYgPSB7XG5cdFx0dHlwZTogby50eXBlLFxuXHRcdGNvbnRlbnQ6IFRva2VuLnN0cmluZ2lmeShvLmNvbnRlbnQsIGxhbmd1YWdlLCBwYXJlbnQpLFxuXHRcdHRhZzogJ3NwYW4nLFxuXHRcdGNsYXNzZXM6IFsndG9rZW4nLCBvLnR5cGVdLFxuXHRcdGF0dHJpYnV0ZXM6IHt9LFxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRwYXJlbnQ6IHBhcmVudFxuXHR9O1xuXG5cdGlmIChvLmFsaWFzKSB7XG5cdFx0dmFyIGFsaWFzZXMgPSBfLnV0aWwudHlwZShvLmFsaWFzKSA9PT0gJ0FycmF5JyA/IG8uYWxpYXMgOiBbby5hbGlhc107XG5cdFx0QXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoZW52LmNsYXNzZXMsIGFsaWFzZXMpO1xuXHR9XG5cblx0Xy5ob29rcy5ydW4oJ3dyYXAnLCBlbnYpO1xuXG5cdHZhciBhdHRyaWJ1dGVzID0gT2JqZWN0LmtleXMoZW52LmF0dHJpYnV0ZXMpLm1hcChmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIG5hbWUgKyAnPVwiJyArIChlbnYuYXR0cmlidXRlc1tuYW1lXSB8fCAnJykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpICsgJ1wiJztcblx0fSkuam9pbignICcpO1xuXG5cdHJldHVybiAnPCcgKyBlbnYudGFnICsgJyBjbGFzcz1cIicgKyBlbnYuY2xhc3Nlcy5qb2luKCcgJykgKyAnXCInICsgKGF0dHJpYnV0ZXMgPyAnICcgKyBhdHRyaWJ1dGVzIDogJycpICsgJz4nICsgZW52LmNvbnRlbnQgKyAnPC8nICsgZW52LnRhZyArICc+JztcblxufTtcblxuaWYgKCFfc2VsZi5kb2N1bWVudCkge1xuXHRpZiAoIV9zZWxmLmFkZEV2ZW50TGlzdGVuZXIpIHtcblx0XHQvLyBpbiBOb2RlLmpzXG5cdFx0cmV0dXJuIF9zZWxmLlByaXNtO1xuXHR9XG5cblx0aWYgKCFfLmRpc2FibGVXb3JrZXJNZXNzYWdlSGFuZGxlcikge1xuXHRcdC8vIEluIHdvcmtlclxuXHRcdF9zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXZ0KSB7XG5cdFx0XHR2YXIgbWVzc2FnZSA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpLFxuXHRcdFx0XHRsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcblx0XHRcdFx0Y29kZSA9IG1lc3NhZ2UuY29kZSxcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2UgPSBtZXNzYWdlLmltbWVkaWF0ZUNsb3NlO1xuXG5cdFx0XHRfc2VsZi5wb3N0TWVzc2FnZShfLmhpZ2hsaWdodChjb2RlLCBfLmxhbmd1YWdlc1tsYW5nXSwgbGFuZykpO1xuXHRcdFx0aWYgKGltbWVkaWF0ZUNsb3NlKSB7XG5cdFx0XHRcdF9zZWxmLmNsb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSwgZmFsc2UpO1xuXHR9XG5cblx0cmV0dXJuIF9zZWxmLlByaXNtO1xufVxuXG4vL0dldCBjdXJyZW50IHNjcmlwdCBhbmQgaGlnaGxpZ2h0XG52YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdCB8fCBbXS5zbGljZS5jYWxsKGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwic2NyaXB0XCIpKS5wb3AoKTtcblxuaWYgKHNjcmlwdCkge1xuXHRfLmZpbGVuYW1lID0gc2NyaXB0LnNyYztcblxuXHRpZiAoIV8ubWFudWFsICYmICFzY3JpcHQuaGFzQXR0cmlidXRlKCdkYXRhLW1hbnVhbCcpKSB7XG5cdFx0aWYoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gXCJsb2FkaW5nXCIpIHtcblx0XHRcdGlmICh3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoXy5oaWdobGlnaHRBbGwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoXy5oaWdobGlnaHRBbGwsIDE2KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgXy5oaWdobGlnaHRBbGwpO1xuXHRcdH1cblx0fVxufVxuXG5yZXR1cm4gX3NlbGYuUHJpc207XG5cbn0pKCk7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRtb2R1bGUuZXhwb3J0cyA9IFByaXNtO1xufVxuXG4vLyBoYWNrIGZvciBjb21wb25lbnRzIHRvIHdvcmsgY29ycmVjdGx5IGluIG5vZGUuanNcbmlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuXHRnbG9iYWwuUHJpc20gPSBQcmlzbTtcbn1cblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLW1hcmt1cC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMubWFya3VwID0ge1xuXHQnY29tbWVudCc6IC88IS0tW1xcc1xcU10qPy0tPi8sXG5cdCdwcm9sb2cnOiAvPFxcP1tcXHNcXFNdKz9cXD8+Lyxcblx0J2RvY3R5cGUnOiAvPCFET0NUWVBFW1xcc1xcU10rPz4vaSxcblx0J2NkYXRhJzogLzwhXFxbQ0RBVEFcXFtbXFxzXFxTXSo/XV0+L2ksXG5cdCd0YWcnOiB7XG5cdFx0cGF0dGVybjogLzxcXC8/KD8hXFxkKVteXFxzPlxcLz0kPF0rKD86XFxzK1teXFxzPlxcLz1dKyg/Oj0oPzooXCJ8JykoPzpcXFxcW1xcc1xcU118KD8hXFwxKVteXFxcXF0pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9ePFxcLz8vLFxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0cGF0dGVybjogLz0oPzooXCJ8JykoPzpcXFxcW1xcc1xcU118KD8hXFwxKVteXFxcXF0pKlxcMXxbXlxccydcIj49XSspL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IFtcblx0XHRcdFx0XHRcdC9ePS8sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFxdKVtcIiddLyxcblx0XHRcdFx0XHRcdFx0bG9va2JlaGluZDogdHJ1ZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdwdW5jdHVhdGlvbic6IC9cXC8/Pi8sXG5cdFx0XHQnYXR0ci1uYW1lJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvW15cXHM+XFwvXSsvLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXlxccz5cXC86XSs6L1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cdH0sXG5cdCdlbnRpdHknOiAvJiM/W1xcZGEtel17MSw4fTsvaVxufTtcblxuUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cFsndGFnJ10uaW5zaWRlWydhdHRyLXZhbHVlJ10uaW5zaWRlWydlbnRpdHknXSA9XG5cdFByaXNtLmxhbmd1YWdlcy5tYXJrdXBbJ2VudGl0eSddO1xuXG4vLyBQbHVnaW4gdG8gbWFrZSBlbnRpdHkgdGl0bGUgc2hvdyB0aGUgcmVhbCBlbnRpdHksIGlkZWEgYnkgUm9tYW4gS29tYXJvdlxuUHJpc20uaG9va3MuYWRkKCd3cmFwJywgZnVuY3Rpb24oZW52KSB7XG5cblx0aWYgKGVudi50eXBlID09PSAnZW50aXR5Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWyd0aXRsZSddID0gZW52LmNvbnRlbnQucmVwbGFjZSgvJmFtcDsvLCAnJicpO1xuXHR9XG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMuaHRtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMubWF0aG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdCdjb21tZW50JzogL1xcL1xcKltcXHNcXFNdKj9cXCpcXC8vLFxuXHQnYXRydWxlJzoge1xuXHRcdHBhdHRlcm46IC9AW1xcdy1dKz8uKj8oPzo7fCg/PVxccypcXHspKS9pLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3J1bGUnOiAvQFtcXHctXSsvXG5cdFx0XHQvLyBTZWUgcmVzdCBiZWxvd1xuXHRcdH1cblx0fSxcblx0J3VybCc6IC91cmxcXCgoPzooW1wiJ10pKD86XFxcXCg/OlxcclxcbnxbXFxzXFxTXSl8KD8hXFwxKVteXFxcXFxcclxcbl0pKlxcMXwuKj8pXFwpL2ksXG5cdCdzZWxlY3Rvcic6IC9bXnt9XFxzXVtee307XSo/KD89XFxzKlxceykvLFxuXHQnc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC8oXCJ8JykoPzpcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxLyxcblx0XHRncmVlZHk6IHRydWVcblx0fSxcblx0J3Byb3BlcnR5JzogL1stX2EtelxceEEwLVxcdUZGRkZdWy1cXHdcXHhBMC1cXHVGRkZGXSooPz1cXHMqOikvaSxcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2ksXG5cdCdmdW5jdGlvbic6IC9bLWEtejAtOV0rKD89XFwoKS9pLFxuXHQncHVuY3R1YXRpb24nOiAvWygpe307Ol0vXG59O1xuXG5QcmlzbS5sYW5ndWFnZXMuY3NzWydhdHJ1bGUnXS5pbnNpZGUucmVzdCA9IFByaXNtLnV0aWwuY2xvbmUoUHJpc20ubGFuZ3VhZ2VzLmNzcyk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3N0eWxlJzoge1xuXHRcdFx0cGF0dGVybjogLyg8c3R5bGVbXFxzXFxTXSo/PilbXFxzXFxTXSo/KD89PFxcL3N0eWxlPikvaSxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3MsXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWNzcycsXG5cdFx0XHRncmVlZHk6IHRydWVcblx0XHR9XG5cdH0pO1xuXG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2luc2lkZScsICdhdHRyLXZhbHVlJywge1xuXHRcdCdzdHlsZS1hdHRyJzoge1xuXHRcdFx0cGF0dGVybjogL1xccypzdHlsZT0oXCJ8JykoPzpcXFxcW1xcc1xcU118KD8hXFwxKVteXFxcXF0pKlxcMS9pLFxuXHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogL15cXHMqc3R5bGUvaSxcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5tYXJrdXAudGFnLmluc2lkZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXlxccyo9XFxzKlsnXCJdfFsnXCJdXFxzKiQvLFxuXHRcdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvLisvaSxcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3Ncblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xuXHRcdH1cblx0fSwgUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcpO1xufVxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNsaWtlLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jbGlrZSA9IHtcblx0J2NvbW1lbnQnOiBbXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXF0pXFwvXFwqW1xcc1xcU10qPyg/OlxcKlxcL3wkKS8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcOl0pXFwvXFwvLiovLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxuXHRcdH1cblx0XSxcblx0J3N0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvKFtcIiddKSg/OlxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKCg/OlxcYig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbXFx3LlxcXFxdKy9pLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHRwdW5jdHVhdGlvbjogL1suXFxcXF0vXG5cdFx0fVxuXHR9LFxuXHQna2V5d29yZCc6IC9cXGIoPzppZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxuZXd8dHJ5fHRocm93fGNhdGNofGZpbmFsbHl8bnVsbHxicmVha3xjb250aW51ZSlcXGIvLFxuXHQnYm9vbGVhbic6IC9cXGIoPzp0cnVlfGZhbHNlKVxcYi8sXG5cdCdmdW5jdGlvbic6IC9bYS16MC05X10rKD89XFwoKS9pLFxuXHQnbnVtYmVyJzogL1xcYi0/KD86MHhbXFxkYS1mXSt8XFxkKlxcLj9cXGQrKD86ZVsrLV0/XFxkKyk/KVxcYi9pLFxuXHQnb3BlcmF0b3InOiAvLS0/fFxcK1xcKz98IT0/PT98PD0/fD49P3w9PT89P3wmJj98XFx8XFx8P3xcXD98XFwqfFxcL3x+fFxcXnwlLyxcblx0J3B1bmN0dWF0aW9uJzogL1t7fVtcXF07KCksLjpdL1xufTtcblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcblx0J2tleXdvcmQnOiAvXFxiKD86YXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxuXHQnbnVtYmVyJzogL1xcYi0/KD86MFt4WF1bXFxkQS1GYS1mXSt8MFtiQl1bMDFdK3wwW29PXVswLTddK3xcXGQqXFwuP1xcZCsoPzpbRWVdWystXT9cXGQrKT98TmFOfEluZmluaXR5KVxcYi8sXG5cdC8vIEFsbG93IGZvciBhbGwgbm9uLUFTQ0lJIGNoYXJhY3RlcnMgKFNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMDA4NDQ0KVxuXHQnZnVuY3Rpb24nOiAvW18kYS16XFx4QTAtXFx1RkZGRl1bJFxcd1xceEEwLVxcdUZGRkZdKig/PVxccypcXCgpL2ksXG5cdCdvcGVyYXRvcic6IC8tWy09XT98XFwrWys9XT98IT0/PT98PDw/PT98Pj4/Pj89P3w9KD86PT0/fD4pP3wmWyY9XT98XFx8W3w9XT98XFwqXFwqPz0/fFxcLz0/fH58XFxePT98JT0/fFxcP3xcXC57M30vXG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnamF2YXNjcmlwdCcsICdrZXl3b3JkJywge1xuXHQncmVnZXgnOiB7XG5cdFx0cGF0dGVybjogLyhefFteL10pXFwvKD8hXFwvKShcXFtbXlxcXVxcclxcbl0rXXxcXFxcLnxbXi9cXFxcXFxbXFxyXFxuXSkrXFwvW2dpbXl1XXswLDV9KD89XFxzKigkfFtcXHJcXG4sLjt9KV0pKS8sXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRncmVlZHk6IHRydWVcblx0fSxcblx0Ly8gVGhpcyBtdXN0IGJlIGRlY2xhcmVkIGJlZm9yZSBrZXl3b3JkIGJlY2F1c2Ugd2UgdXNlIFwiZnVuY3Rpb25cIiBpbnNpZGUgdGhlIGxvb2stZm9yd2FyZFxuXHQnZnVuY3Rpb24tdmFyaWFibGUnOiB7XG5cdFx0cGF0dGVybjogL1tfJGEtelxceEEwLVxcdUZGRkZdWyRcXHdcXHhBMC1cXHVGRkZGXSooPz1cXHMqPVxccyooPzpmdW5jdGlvblxcYnwoPzpcXChbXigpXSpcXCl8W18kYS16XFx4QTAtXFx1RkZGRl1bJFxcd1xceEEwLVxcdUZGRkZdKilcXHMqPT4pKS9pLFxuXHRcdGFsaWFzOiAnZnVuY3Rpb24nXG5cdH1cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcblx0J3RlbXBsYXRlLXN0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvYCg/OlxcXFxbXFxzXFxTXXxbXlxcXFxgXSkqYC8sXG5cdFx0Z3JlZWR5OiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J2ludGVycG9sYXRpb24nOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9cXCRcXHtbXn1dK1xcfS8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdpbnRlcnBvbGF0aW9uLXB1bmN0dWF0aW9uJzoge1xuXHRcdFx0XHRcdFx0cGF0dGVybjogL15cXCRcXHt8XFx9JC8sXG5cdFx0XHRcdFx0XHRhbGlhczogJ3B1bmN0dWF0aW9uJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVzdDogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHRcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdzdHJpbmcnOiAvW1xcc1xcU10rL1xuXHRcdH1cblx0fVxufSk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3NjcmlwdCc6IHtcblx0XHRcdHBhdHRlcm46IC8oPHNjcmlwdFtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc2NyaXB0PikvaSxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0LFxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1qYXZhc2NyaXB0Jyxcblx0XHRcdGdyZWVkeTogdHJ1ZVxuXHRcdH1cblx0fSk7XG59XG5cblByaXNtLmxhbmd1YWdlcy5qcyA9IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tZmlsZS1oaWdobGlnaHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuKGZ1bmN0aW9uICgpIHtcblx0aWYgKHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyB8fCAhc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHNlbGYuUHJpc20uZmlsZUhpZ2hsaWdodCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIEV4dGVuc2lvbnMgPSB7XG5cdFx0XHQnanMnOiAnamF2YXNjcmlwdCcsXG5cdFx0XHQncHknOiAncHl0aG9uJyxcblx0XHRcdCdyYic6ICdydWJ5Jyxcblx0XHRcdCdwczEnOiAncG93ZXJzaGVsbCcsXG5cdFx0XHQncHNtMSc6ICdwb3dlcnNoZWxsJyxcblx0XHRcdCdzaCc6ICdiYXNoJyxcblx0XHRcdCdiYXQnOiAnYmF0Y2gnLFxuXHRcdFx0J2gnOiAnYycsXG5cdFx0XHQndGV4JzogJ2xhdGV4J1xuXHRcdH07XG5cblx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xuXHRcdFx0dmFyIHNyYyA9IHByZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG5cblx0XHRcdHZhciBsYW5ndWFnZSwgcGFyZW50ID0gcHJlO1xuXHRcdFx0dmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oPyFcXCopKFxcdyspXFxiL2k7XG5cdFx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdFx0bGFuZ3VhZ2UgPSAocHJlLmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCAnJ10pWzFdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWxhbmd1YWdlKSB7XG5cdFx0XHRcdHZhciBleHRlbnNpb24gPSAoc3JjLm1hdGNoKC9cXC4oXFx3KykkLykgfHwgWywgJyddKVsxXTtcblx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKTtcblx0XHRcdGNvZGUuY2xhc3NOYW1lID0gJ2xhbmd1YWdlLScgKyBsYW5ndWFnZTtcblxuXHRcdFx0cHJlLnRleHRDb250ZW50ID0gJyc7XG5cblx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAnTG9hZGluZ+KApic7XG5cblx0XHRcdHByZS5hcHBlbmRDaGlsZChjb2RlKTtcblxuXHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG5cdFx0XHR4aHIub3BlbignR0VUJywgc3JjLCB0cnVlKTtcblxuXHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcblxuXHRcdFx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcblx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSB4aHIucmVzcG9uc2VUZXh0O1xuXG5cdFx0XHRcdFx0XHRQcmlzbS5oaWdobGlnaHRFbGVtZW50KGNvZGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xuXHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3IgJyArIHhoci5zdGF0dXMgKyAnIHdoaWxlIGZldGNoaW5nIGZpbGU6ICcgKyB4aHIuc3RhdHVzVGV4dDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvcjogRmlsZSBkb2VzIG5vdCBleGlzdCBvciBpcyBlbXB0eSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR4aHIuc2VuZChudWxsKTtcblx0XHR9KTtcblxuXHR9O1xuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBzZWxmLlByaXNtLmZpbGVIaWdobGlnaHQpO1xuXG59KSgpO1xuIl19
