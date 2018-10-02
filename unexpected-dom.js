(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*global DOMParser*/
var matchesSelector = require('./matchesSelector');

function parseHtml(str, isFragment, assertionNameForErrorMessage) {
  if (isFragment) {
    str = '<html><head></head><body>' + str + '</body></html>';
  }
  var htmlDocument;
  if (typeof DOMParser !== 'undefined') {
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

var matchSimpleAttribute = /^(?:allowfullscreen|async|autofocus|autoplay|checked|compact|controls|declare|default|defaultchecked|defaultmuted|defaultselected|defer|disabled|enabled|formnovalidate|hidden|indeterminate|inert|ismap|itemscope|loop|multiple|muted|nohref|noresize|noshade|novalidate|nowrap|open|pauseonexit|readonly|required|reversed|scoped|seamless|selected|sortable|spellcheck|truespeed|typemustmatch|visible)$/i;

function isBooleanAttribute(attrName) {
  return matchSimpleAttribute.test(attrName);
}

function isEnumeratedAttribute(attrName) {
  return attrName in enumeratedAttributeValues;
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
    return [];
  }

  if (attributeValue === '') {
    return [];
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
  if (
    isBooleanAttribute(attributeName) ||
    isEnumeratedAttribute(attributeName)
  ) {
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

    function bubbleError(body) {
      return expect.withError(body, function(err) {
        err.errorMode = 'bubble';
        throw err;
      });
    }

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

    // Recognize <!-- ignore --> as a special subtype of DOMComment so it can be targeted by assertions:
    expect.exportType({
      name: 'DOMIgnoreComment',
      base: 'DOMComment',
      identify: function(obj) {
        return (
          this.baseType.identify(obj) && /^\s*ignore\s*$/.test(obj.nodeValue)
        );
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

            var width = startTag.length;
            var multipleLines = inspectedChildren.some(function(o) {
              var size = o.size();
              width += size.width;
              return width > 60 || o.height > 1;
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
            return bubbleError(function() {
              return expect(actualClasses.sort(), 'to equal', value.sort());
            });
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

    expect.exportAssertion(
      '<DOMComment> to [exhaustively] satisfy <DOMComment>',
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

    // Always passes:
    expect.exportAssertion(
      // Name each subject type to increase the specificity of the assertion
      '<DOMComment|DOMElement|DOMTextNode|DOMDocument|HTMLDocType> to [exhaustively] satisfy <DOMIgnoreComment>',
      function(expect, subject, value) {}
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
        var name = isHtml ? node.nodeName.toLowerCase() : node.nodeName;

        if (name === 'ignore') {
          // Ignore subtree
          return expect.it('to be an', 'DOMNode');
        }

        var result = { name: name };

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
      } else if (node.nodeType === 8) {
        // DOMComment
        return node;
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
      '<DOMElement|DOMDocumentFragment|DOMDocument> to [exhaustively] satisfy <regexp>',
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
              return bubbleError(function() {
                return expect(
                  isHtml ? subject.nodeName.toLowerCase() : subject.nodeName,
                  'to satisfy',
                  value.name
                );
              });
            }
          }),
          children: expect.promise(function() {
            if (typeof value.children !== 'undefined') {
              if (typeof value.textContent !== 'undefined') {
                throw new Error(
                  'The children and textContent properties are not supported together'
                );
              }
              return bubbleError(function() {
                return expect(
                  makeAttachedDOMNodeList(
                    subject.childNodes,
                    subject.ownerDocument.contentType
                  ),
                  'to satisfy',
                  value.children
                );
              });
            } else if (typeof value.textContent !== 'undefined') {
              return bubbleError(function() {
                return expect(
                  subject.textContent,
                  'to satisfy',
                  value.textContent
                );
              });
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
              if (typeof expectedAttributeValue === 'undefined') {
                return bubbleError(function() {
                  expect(subject.hasAttribute(attributeName), 'to be false');
                });
              } else if (isEnumeratedAttribute(attributeName)) {
                var indexOfEnumeratedAttributeValue = enumeratedAttributeValues[
                  attributeName
                ].indexOf(expectedAttributeValue);

                return bubbleError(function() {
                  if (indexOfEnumeratedAttributeValue === -1) {
                    expect.fail(function(output) {
                      output
                        .text('Invalid expected value ')
                        .appendInspected(expectedAttributeValue)
                        .text('. Supported values include: ')
                        .appendItems(
                          enumeratedAttributeValues[attributeName],
                          ', '
                        );
                    });
                  }

                  expect(attributeValue, 'to satisfy', expectedAttributeValue);
                });
              } else if (expectedAttributeValue === true) {
                return bubbleError(function() {
                  expect(subject.hasAttribute(attributeName), 'to be true');
                });
              } else if (
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
                  return bubbleError(function() {
                    return expect(
                      actualClasses.sort(),
                      'to equal',
                      expectedClasses.sort()
                    );
                  });
                } else {
                  if (expectedClasses.length === 0) {
                    return bubbleError(function() {
                      return expect(expectedClasses, 'to be empty');
                    });
                  }
                  return bubbleError(function() {
                    return expect.apply(
                      expect,
                      [actualClasses, 'to contain'].concat(expectedClasses)
                    );
                  });
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
                  return bubbleError(function() {
                    return expect(
                      attrs.style,
                      'to exhaustively satisfy',
                      expectedStyleObj
                    );
                  });
                } else {
                  return bubbleError(function() {
                    return expect(attrs.style, 'to satisfy', expectedStyleObj);
                  });
                }
              } else {
                return bubbleError(function() {
                  return expect(
                    attributeValue,
                    'to satisfy',
                    expectedAttributeValue
                  );
                });
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
                  var seenError = false;
                  output
                    .prismPunctuation('<')
                    .prismTag(
                      isHtml ? subject.nodeName.toLowerCase() : subject.nodeName
                    );
                  if (promiseByKey.name.isRejected()) {
                    seenError = true;
                    var nameError = promiseByKey.name.reason();
                    output.sp().annotationBlock(function() {
                      this.error(
                        (nameError && nameError.getLabel()) || 'should satisfy'
                      )
                        .sp()
                        .append(inspect(value.name));
                    });
                  }
                  var inspectedAttributes = [];
                  Object.keys(attrs).forEach(function(attributeName) {
                    var attributeOutput = output.clone();
                    var promise = promiseByKey.attributes[attributeName];
                    writeAttributeToMagicPen(
                      attributeOutput,
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
                    } else {
                      seenError = true;
                      attributeOutput.sp().annotationBlock(function() {
                        if (
                          promise &&
                          typeof expectedValueByAttributeName[attributeName] !==
                            'undefined'
                        ) {
                          this.append(promise.reason().getErrorMessage(this));
                        } else {
                          // onlyAttributes === true
                          this.error('should be removed');
                        }
                      });
                    }
                    inspectedAttributes.push(attributeOutput);
                  });
                  expectedAttributeNames.forEach(function(attributeName) {
                    if (!subject.hasAttribute(attributeName)) {
                      var promise = promiseByKey.attributes[attributeName];
                      if (!promise || promise.isRejected()) {
                        seenError = true;
                        var err = promise && promise.reason();
                        var attributeOutput = output
                          .clone()
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
                          });
                        inspectedAttributes.push(attributeOutput);
                      }
                    }
                  });
                  if (inspectedAttributes.length > 0) {
                    if (seenError) {
                      output
                        .nl()
                        .indentLines()
                        .indent()
                        .block(function(output) {
                          inspectedAttributes.forEach(function(item, i) {
                            if (i > 0) {
                              output.nl();
                            }
                            output.append(item);
                          });
                        })
                        .outdentLines()
                        .nl();
                    } else {
                      output.sp();
                      inspectedAttributes.forEach(function(item, i) {
                        if (i > 0) {
                          output.sp();
                        }
                        output.append(item);
                      });
                    }
                  } else if (seenError) {
                    // The tag name mismatched
                    output.nl();
                  }

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

    expect.exportAssertion(
      '<DOMElement> to have [no] (child|children)',
      function(expect, subject) {
        if (expect.flags.no) {
          return expect(subject.childNodes, 'to be empty');
        } else {
          return expect(subject.childNodes, 'not to be empty');
        }
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
            expect.subjectOutput = function(output) {
              expect.inspect(subject, Infinity, output);
            };
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
            expect.subjectOutput = function(output) {
              expect.inspect(subject, Infinity, output);
            };
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

        expect.subjectOutput = function(output) {
          expect.inspect(subject, Infinity, output);
        };
        return expect(subject.querySelectorAll(query), 'not to satisfy', []);
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to match <string>',
      function(expect, subject, query) {
        expect.subjectOutput = function(output) {
          expect.inspect(subject, Infinity, output);
        };
        return expect(matchesSelector(subject, query), '[not] to be true');
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
    "/",
    "/unexpected-markdown"
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvbWF0Y2hlc1NlbGVjdG9yLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL2xpYi9tYWdpY1BlblByaXNtLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL3BhY2thZ2UuanNvbiIsIm5vZGVfbW9kdWxlcy9wcmlzbWpzL2NvbXBvbmVudHMvcHJpc20tY3NwLmpzIiwibm9kZV9tb2R1bGVzL3ByaXNtanMvY29tcG9uZW50cy9wcmlzbS1ncmFwaHFsLmpzIiwibm9kZV9tb2R1bGVzL3ByaXNtanMvcHJpc20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ24rQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qZ2xvYmFsIERPTVBhcnNlciovXG52YXIgbWF0Y2hlc1NlbGVjdG9yID0gcmVxdWlyZSgnLi9tYXRjaGVzU2VsZWN0b3InKTtcblxuZnVuY3Rpb24gcGFyc2VIdG1sKHN0ciwgaXNGcmFnbWVudCwgYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSkge1xuICBpZiAoaXNGcmFnbWVudCkge1xuICAgIHN0ciA9ICc8aHRtbD48aGVhZD48L2hlYWQ+PGJvZHk+JyArIHN0ciArICc8L2JvZHk+PC9odG1sPic7XG4gIH1cbiAgdmFyIGh0bWxEb2N1bWVudDtcbiAgaWYgKHR5cGVvZiBET01QYXJzZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaHRtbERvY3VtZW50ID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhzdHIsICd0ZXh0L2h0bWwnKTtcbiAgfSBlbHNlIGlmIChcbiAgICB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmXG4gICAgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24gJiZcbiAgICBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVIVE1MRG9jdW1lbnRcbiAgKSB7XG4gICAgaHRtbERvY3VtZW50ID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KCcnKTtcbiAgICBodG1sRG9jdW1lbnQub3BlbigpO1xuICAgIGh0bWxEb2N1bWVudC53cml0ZShzdHIpO1xuICAgIGh0bWxEb2N1bWVudC5jbG9zZSgpO1xuICB9IGVsc2Uge1xuICAgIHZhciBqc2RvbTtcbiAgICB0cnkge1xuICAgICAganNkb20gPSByZXF1aXJlKCcnICsgJ2pzZG9tJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICd1bmV4cGVjdGVkLWRvbScgK1xuICAgICAgICAgIChhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlXG4gICAgICAgICAgICA/ICcgKCcgKyBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlICsgJyknXG4gICAgICAgICAgICA6ICcnKSArXG4gICAgICAgICAgJzogUnVubmluZyBvdXRzaWRlIGEgYnJvd3NlciwgYnV0IGNvdWxkIG5vdCBmaW5kIHRoZSBganNkb21gIG1vZHVsZS4gUGxlYXNlIG5wbSBpbnN0YWxsIGpzZG9tIHRvIG1ha2UgdGhpcyB3b3JrLidcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChqc2RvbS5KU0RPTSkge1xuICAgICAgaHRtbERvY3VtZW50ID0gbmV3IGpzZG9tLkpTRE9NKHN0cikud2luZG93LmRvY3VtZW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBodG1sRG9jdW1lbnQgPSBqc2RvbS5qc2RvbShzdHIpO1xuICAgIH1cbiAgfVxuICBpZiAoaXNGcmFnbWVudCkge1xuICAgIHZhciBib2R5ID0gaHRtbERvY3VtZW50LmJvZHk7XG4gICAgdmFyIGRvY3VtZW50RnJhZ21lbnQgPSBodG1sRG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIGlmIChib2R5KSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJvZHkuY2hpbGROb2Rlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBkb2N1bWVudEZyYWdtZW50LmFwcGVuZENoaWxkKGJvZHkuY2hpbGROb2Rlc1tpXS5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZG9jdW1lbnRGcmFnbWVudDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gaHRtbERvY3VtZW50O1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlWG1sKHN0ciwgYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSkge1xuICBpZiAodHlwZW9mIERPTVBhcnNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhzdHIsICd0ZXh0L3htbCcpO1xuICB9IGVsc2Uge1xuICAgIHZhciBqc2RvbTtcbiAgICB0cnkge1xuICAgICAganNkb20gPSByZXF1aXJlKCcnICsgJ2pzZG9tJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICd1bmV4cGVjdGVkLWRvbScgK1xuICAgICAgICAgIChhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlXG4gICAgICAgICAgICA/ICcgKCcgKyBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlICsgJyknXG4gICAgICAgICAgICA6ICcnKSArXG4gICAgICAgICAgJzogUnVubmluZyBvdXRzaWRlIGEgYnJvd3NlciAob3IgaW4gYSBicm93c2VyIHdpdGhvdXQgRE9NUGFyc2VyKSwgYnV0IGNvdWxkIG5vdCBmaW5kIHRoZSBganNkb21gIG1vZHVsZS4gUGxlYXNlIG5wbSBpbnN0YWxsIGpzZG9tIHRvIG1ha2UgdGhpcyB3b3JrLidcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChqc2RvbS5KU0RPTSkge1xuICAgICAgcmV0dXJuIG5ldyBqc2RvbS5KU0RPTShzdHIsIHsgY29udGVudFR5cGU6ICd0ZXh0L3htbCcgfSkud2luZG93LmRvY3VtZW50O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ganNkb20uanNkb20oc3RyLCB7IHBhcnNpbmdNb2RlOiAneG1sJyB9KTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRnJvbSBodG1sLW1pbmlmaWVyXG52YXIgZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlcyA9IHtcbiAgZHJhZ2dhYmxlOiBbJ3RydWUnLCAnZmFsc2UnXSAvLyBkZWZhdWx0cyB0byAnYXV0bydcbn07XG5cbnZhciBtYXRjaFNpbXBsZUF0dHJpYnV0ZSA9IC9eKD86YWxsb3dmdWxsc2NyZWVufGFzeW5jfGF1dG9mb2N1c3xhdXRvcGxheXxjaGVja2VkfGNvbXBhY3R8Y29udHJvbHN8ZGVjbGFyZXxkZWZhdWx0fGRlZmF1bHRjaGVja2VkfGRlZmF1bHRtdXRlZHxkZWZhdWx0c2VsZWN0ZWR8ZGVmZXJ8ZGlzYWJsZWR8ZW5hYmxlZHxmb3Jtbm92YWxpZGF0ZXxoaWRkZW58aW5kZXRlcm1pbmF0ZXxpbmVydHxpc21hcHxpdGVtc2NvcGV8bG9vcHxtdWx0aXBsZXxtdXRlZHxub2hyZWZ8bm9yZXNpemV8bm9zaGFkZXxub3ZhbGlkYXRlfG5vd3JhcHxvcGVufHBhdXNlb25leGl0fHJlYWRvbmx5fHJlcXVpcmVkfHJldmVyc2VkfHNjb3BlZHxzZWFtbGVzc3xzZWxlY3RlZHxzb3J0YWJsZXxzcGVsbGNoZWNrfHRydWVzcGVlZHx0eXBlbXVzdG1hdGNofHZpc2libGUpJC9pO1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0ck5hbWUpIHtcbiAgcmV0dXJuIG1hdGNoU2ltcGxlQXR0cmlidXRlLnRlc3QoYXR0ck5hbWUpO1xufVxuXG5mdW5jdGlvbiBpc0VudW1lcmF0ZWRBdHRyaWJ1dGUoYXR0ck5hbWUpIHtcbiAgcmV0dXJuIGF0dHJOYW1lIGluIGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXM7XG59XG5cbmZ1bmN0aW9uIHN0eWxlU3RyaW5nVG9PYmplY3Qoc3RyKSB7XG4gIHZhciBzdHlsZXMgPSB7fTtcblxuICBzdHIuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uKHJ1bGUpIHtcbiAgICB2YXIgdHVwbGUgPSBydWxlLnNwbGl0KCc6JykubWFwKGZ1bmN0aW9uKHBhcnQpIHtcbiAgICAgIHJldHVybiBwYXJ0LnRyaW0oKTtcbiAgICB9KTtcblxuICAgIC8vIEd1YXJkIGFnYWluc3QgZW1wdHkgdG91cGxlc1xuICAgIGlmICh0dXBsZVswXSAmJiB0dXBsZVsxXSkge1xuICAgICAgc3R5bGVzW3R1cGxlWzBdXSA9IHR1cGxlWzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSkge1xuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09ICcnKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgdmFyIGNsYXNzTmFtZXMgPSBhdHRyaWJ1dGVWYWx1ZS5zcGxpdCgvXFxzKy8pO1xuICBpZiAoY2xhc3NOYW1lcy5sZW5ndGggPT09IDEgJiYgY2xhc3NOYW1lc1swXSA9PT0gJycpIHtcbiAgICBjbGFzc05hbWVzLnBvcCgpO1xuICB9XG4gIHJldHVybiBjbGFzc05hbWVzO1xufVxuXG5mdW5jdGlvbiBpc0luc2lkZUh0bWxEb2N1bWVudChub2RlKSB7XG4gIHZhciBvd25lckRvY3VtZW50O1xuICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gOSAmJiBub2RlLmRvY3VtZW50RWxlbWVudCAmJiBub2RlLmltcGxlbWVudGF0aW9uKSB7XG4gICAgb3duZXJEb2N1bWVudCA9IG5vZGU7XG4gIH0gZWxzZSB7XG4gICAgb3duZXJEb2N1bWVudCA9IG5vZGUub3duZXJEb2N1bWVudDtcbiAgfVxuICBpZiAob3duZXJEb2N1bWVudC5jb250ZW50VHlwZSkge1xuICAgIHJldHVybiBvd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb3duZXJEb2N1bWVudC50b1N0cmluZygpID09PSAnW29iamVjdCBIVE1MRG9jdW1lbnRdJztcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGVsZW1lbnQpO1xuICB2YXIgYXR0cnMgPSBlbGVtZW50LmF0dHJpYnV0ZXM7XG4gIHZhciByZXN1bHQgPSB7fTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgaWYgKGF0dHJzW2ldLm5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9XG4gICAgICAgIChhdHRyc1tpXS52YWx1ZSAmJiBhdHRyc1tpXS52YWx1ZS5zcGxpdCgnICcpKSB8fCBbXTtcbiAgICB9IGVsc2UgaWYgKGF0dHJzW2ldLm5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IHN0eWxlU3RyaW5nVG9PYmplY3QoYXR0cnNbaV0udmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPVxuICAgICAgICBpc0h0bWwgJiYgaXNCb29sZWFuQXR0cmlidXRlKGF0dHJzW2ldLm5hbWUpXG4gICAgICAgICAgPyB0cnVlXG4gICAgICAgICAgOiBhdHRyc1tpXS52YWx1ZSB8fCAnJztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKVxuICAgIC5zb3J0KClcbiAgICAuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gYXR0cnNba2V5XTtcbiAgICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBlbnRpdGlmeSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKVxuICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpIHtcbiAgcmV0dXJuIC8oPzphcmVhfGJhc2V8YnJ8Y29sfGVtYmVkfGhyfGltZ3xpbnB1dHxrZXlnZW58bGlua3xtZW51aXRlbXxtZXRhfHBhcmFtfHNvdXJjZXx0cmFja3x3YnIpL2kudGVzdChcbiAgICBlbGVtZW50TmFtZVxuICApO1xufVxuXG5mdW5jdGlvbiB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4ob3V0cHV0LCBhdHRyaWJ1dGVOYW1lLCB2YWx1ZSwgaXNIdG1sKSB7XG4gIG91dHB1dC5wcmlzbUF0dHJOYW1lKGF0dHJpYnV0ZU5hbWUpO1xuICBpZiAoIWlzSHRtbCB8fCAhaXNCb29sZWFuQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUuam9pbignICcpO1xuICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlTmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgdmFsdWUgPSBPYmplY3Qua2V5cyh2YWx1ZSlcbiAgICAgICAgLm1hcChmdW5jdGlvbihjc3NQcm9wKSB7XG4gICAgICAgICAgcmV0dXJuIGNzc1Byb3AgKyAnOiAnICsgdmFsdWVbY3NzUHJvcF07XG4gICAgICAgIH0pXG4gICAgICAgIC5qb2luKCc7ICcpO1xuICAgIH1cbiAgICBvdXRwdXRcbiAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc9XCInKVxuICAgICAgLnByaXNtQXR0clZhbHVlKGVudGl0aWZ5KHZhbHVlKSlcbiAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCdcIicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lLCB2YWx1ZSkge1xuICBpZiAoXG4gICAgaXNCb29sZWFuQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpIHx8XG4gICAgaXNFbnVtZXJhdGVkQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpXG4gICkge1xuICAgIHJldHVybiBhdHRyaWJ1dGVOYW1lO1xuICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdjbGFzcycpIHtcbiAgICByZXR1cm4gJ2NsYXNzPVwiJyArIHZhbHVlLmpvaW4oJyAnKSArICdcIic7IC8vIEZJWE1FOiBlbnRpdGlmeVxuICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICByZXR1cm4gKFxuICAgICAgJ3N0eWxlPVwiJyArXG4gICAgICBPYmplY3Qua2V5cyh2YWx1ZSlcbiAgICAgICAgLm1hcChmdW5jdGlvbihjc3NQcm9wKSB7XG4gICAgICAgICAgcmV0dXJuIFtjc3NQcm9wLCB2YWx1ZVtjc3NQcm9wXV0uam9pbignOiAnKTsgLy8gRklYTUU6IGVudGl0aWZ5XG4gICAgICAgIH0pXG4gICAgICAgIC5qb2luKCc7ICcpICtcbiAgICAgICdcIidcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhdHRyaWJ1dGVOYW1lICsgJz1cIicgKyBlbnRpdGlmeSh2YWx1ZSkgKyAnXCInO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeVN0YXJ0VGFnKGVsZW1lbnQpIHtcbiAgdmFyIGVsZW1lbnROYW1lID1cbiAgICBlbGVtZW50Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnXG4gICAgICA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICB2YXIgc3RyID0gJzwnICsgZWxlbWVudE5hbWU7XG4gIHZhciBhdHRycyA9IGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCk7XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgc3RyICs9ICcgJyArIHN0cmluZ2lmeUF0dHJpYnV0ZShrZXksIGF0dHJzW2tleV0pO1xuICB9KTtcblxuICBzdHIgKz0gJz4nO1xuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlFbmRUYWcoZWxlbWVudCkge1xuICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoZWxlbWVudCk7XG4gIHZhciBlbGVtZW50TmFtZSA9IGlzSHRtbCA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG4gIGlmIChpc0h0bWwgJiYgaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkgJiYgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJzwvJyArIGVsZW1lbnROYW1lICsgJz4nO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBuYW1lOiAndW5leHBlY3RlZC1kb20nLFxuICBpbnN0YWxsSW50bzogZnVuY3Rpb24oZXhwZWN0KSB7XG4gICAgZXhwZWN0ID0gZXhwZWN0LmNoaWxkKCk7XG4gICAgZXhwZWN0LnVzZShyZXF1aXJlKCdtYWdpY3Blbi1wcmlzbScpKTtcblxuICAgIGZ1bmN0aW9uIGJ1YmJsZUVycm9yKGJvZHkpIHtcbiAgICAgIHJldHVybiBleHBlY3Qud2l0aEVycm9yKGJvZHksIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBlcnIuZXJyb3JNb2RlID0gJ2J1YmJsZSc7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlJyxcbiAgICAgIGJhc2U6ICdvYmplY3QnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iaiAmJlxuICAgICAgICAgIG9iai5ub2RlTmFtZSAmJlxuICAgICAgICAgIFsyLCAzLCA0LCA1LCA2LCA3LCAxMCwgMTEsIDEyXS5pbmRleE9mKG9iai5ub2RlVHlwZSkgPiAtMVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoXG4gICAgICAgICAgZWxlbWVudC5ub2RlTmFtZSArICcgXCInICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnXCInLFxuICAgICAgICAgICdwcmlzbS1zdHJpbmcnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NQ29tbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSA4O1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24oZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoJzwhLS0nICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnLS0+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihcbiAgICAgICAgICAnPCEtLScgKyBhY3R1YWwubm9kZVZhbHVlICsgJy0tPicsXG4gICAgICAgICAgJzwhLS0nICsgZXhwZWN0ZWQubm9kZVZhbHVlICsgJy0tPidcbiAgICAgICAgKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFJlY29nbml6ZSA8IS0tIGlnbm9yZSAtLT4gYXMgYSBzcGVjaWFsIHN1YnR5cGUgb2YgRE9NQ29tbWVudCBzbyBpdCBjYW4gYmUgdGFyZ2V0ZWQgYnkgYXNzZXJ0aW9uczpcbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NSWdub3JlQ29tbWVudCcsXG4gICAgICBiYXNlOiAnRE9NQ29tbWVudCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIC9eXFxzKmlnbm9yZVxccyokLy50ZXN0KG9iai5ub2RlVmFsdWUpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NVGV4dE5vZGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gMztcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUgPT09IGIubm9kZVZhbHVlO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVudGl0aWZ5KGVsZW1lbnQubm9kZVZhbHVlLnRyaW0oKSksICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgZCA9IGRpZmYoYWN0dWFsLm5vZGVWYWx1ZSwgZXhwZWN0ZWQubm9kZVZhbHVlKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlTGlzdCcsXG4gICAgICBiYXNlOiAnYXJyYXktbGlrZScsXG4gICAgICBwcmVmaXg6IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ05vZGVMaXN0WycpO1xuICAgICAgfSxcbiAgICAgIHN1ZmZpeDogZnVuY3Rpb24ob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnXScpO1xuICAgICAgfSxcbiAgICAgIHNpbWlsYXI6IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgLy8gRmlndXJlIG91dCB3aGV0aGVyIGEgYW5kIGIgYXJlIFwic3RydXR1cmFsbHkgc2ltaWxhclwiIHNvIHRoZXkgY2FuIGJlIGRpZmZlZCBpbmxpbmUuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgYS5ub2RlVHlwZSA9PT0gMSAmJiBiLm5vZGVUeXBlID09PSAxICYmIGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWVcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgb2JqICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5sZW5ndGggPT09ICdudW1iZXInICYmXG4gICAgICAgICAgdHlwZW9mIG9iai50b1N0cmluZyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIHR5cGVvZiBvYmouaXRlbSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIC8vIFdpdGgganNkb20gNissIG5vZGVMaXN0LnRvU3RyaW5nKCkgY29tZXMgb3V0IGFzICdbb2JqZWN0IE9iamVjdF0nLCBzbyBmYWxsIGJhY2sgdG8gdGhlIGNvbnN0cnVjdG9yIG5hbWU6XG4gICAgICAgICAgKG9iai50b1N0cmluZygpLmluZGV4T2YoJ05vZGVMaXN0JykgIT09IC0xIHx8XG4gICAgICAgICAgICAob2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSAnTm9kZUxpc3QnKSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEZha2UgdHlwZSB0byBtYWtlIGl0IHBvc3NpYmxlIHRvIGJ1aWxkICd0byBzYXRpc2Z5JyBkaWZmcyB0byBiZSByZW5kZXJlZCBpbmxpbmU6XG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ2F0dGFjaGVkRE9NTm9kZUxpc3QnLFxuICAgICAgYmFzZTogJ0RPTU5vZGVMaXN0JyxcbiAgICAgIGluZGVudDogZmFsc2UsXG4gICAgICBwcmVmaXg6IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIHN1ZmZpeDogZnVuY3Rpb24ob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgZGVsaW1pdGVyOiBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLl9pc0F0dGFjaGVkRE9NTm9kZUxpc3Q7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChkb21Ob2RlTGlzdCwgY29udGVudFR5cGUpIHtcbiAgICAgIHZhciBhdHRhY2hlZERPTU5vZGVMaXN0ID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvbU5vZGVMaXN0Lmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGF0dGFjaGVkRE9NTm9kZUxpc3QucHVzaChkb21Ob2RlTGlzdFtpXSk7XG4gICAgICB9XG4gICAgICBhdHRhY2hlZERPTU5vZGVMaXN0Ll9pc0F0dGFjaGVkRE9NTm9kZUxpc3QgPSB0cnVlO1xuICAgICAgYXR0YWNoZWRET01Ob2RlTGlzdC5vd25lckRvY3VtZW50ID0geyBjb250ZW50VHlwZTogY29udGVudFR5cGUgfTtcbiAgICAgIHJldHVybiBhdHRhY2hlZERPTU5vZGVMaXN0O1xuICAgIH1cblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRG9jVHlwZScsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgb2JqICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICBvYmoubm9kZVR5cGUgPT09IDEwICYmXG4gICAgICAgICAgJ3B1YmxpY0lkJyBpbiBvYmpcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbihkb2N0eXBlLCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZSgnPCFET0NUWVBFICcgKyBkb2N0eXBlLm5hbWUgKyAnPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZikge1xuICAgICAgICB2YXIgZCA9IGRpZmYoXG4gICAgICAgICAgJzwhRE9DVFlQRSAnICsgYWN0dWFsLm5hbWUgKyAnPicsXG4gICAgICAgICAgJzwhRE9DVFlQRSAnICsgZXhwZWN0ZWQubmFtZSArICc+J1xuICAgICAgICApO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTURvY3VtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBvYmogJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgICAgICAgIG9iai5ub2RlVHlwZSA9PT0gOSAmJlxuICAgICAgICAgIG9iai5kb2N1bWVudEVsZW1lbnQgJiZcbiAgICAgICAgICBvYmouaW1wbGVtZW50YXRpb25cbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbihkb2N1bWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICBvdXRwdXQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgb3V0cHV0LmFwcGVuZChcbiAgICAgICAgICBkaWZmKFxuICAgICAgICAgICAgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoYWN0dWFsLmNoaWxkTm9kZXMpLFxuICAgICAgICAgICAgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoZXhwZWN0ZWQuY2hpbGROb2RlcylcbiAgICAgICAgICApLmRpZmZcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTURvY3VtZW50JyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmFzZVR5cGUuaWRlbnRpZnkob2JqKSAmJiBvYmouY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ1hNTERvY3VtZW50JyxcbiAgICAgIGJhc2U6ICdET01Eb2N1bWVudCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmXG4gICAgICAgICAgL14oPzphcHBsaWNhdGlvbnx0ZXh0KVxcL3htbHxcXCt4bWxcXGIvLnRlc3Qob2JqLmNvbnRlbnRUeXBlKVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8P3htbCB2ZXJzaW9uPVwiMS4wXCI/PicsICd4bWwnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb2N1bWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0KGRvY3VtZW50LmNoaWxkTm9kZXNbaV0sIGRlcHRoIC0gMSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRG9jdW1lbnRGcmFnbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxMTsgLy8gSW4ganNkb20sIGRvY3VtZW50RnJhZ21lbnQudG9TdHJpbmcoKSBkb2VzIG5vdCByZXR1cm4gW29iamVjdCBEb2N1bWVudEZyYWdtZW50XVxuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uKGRvY3VtZW50RnJhZ21lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dFxuICAgICAgICAgIC50ZXh0KCdEb2N1bWVudEZyYWdtZW50WycpXG4gICAgICAgICAgLmFwcGVuZChpbnNwZWN0KGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2RlcywgZGVwdGgpKVxuICAgICAgICAgIC50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICBvdXRwdXQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgb3V0cHV0LmJsb2NrKFxuICAgICAgICAgIGRpZmYoXG4gICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChhY3R1YWwuY2hpbGROb2RlcyksXG4gICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChleHBlY3RlZC5jaGlsZE5vZGVzKVxuICAgICAgICAgICkuZGlmZlxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUVsZW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iaiAmJlxuICAgICAgICAgIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgICAgICAgb2JqLm5vZGVUeXBlID09PSAxICYmXG4gICAgICAgICAgb2JqLm5vZGVOYW1lICYmXG4gICAgICAgICAgb2JqLmF0dHJpYnV0ZXNcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24oYSwgYiwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGFJc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChhKTtcbiAgICAgICAgdmFyIGJJc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChiKTtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBhSXNIdG1sID09PSBiSXNIdG1sICYmXG4gICAgICAgICAgKGFJc0h0bWxcbiAgICAgICAgICAgID8gYS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSBiLm5vZGVOYW1lLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgIDogYS5ub2RlTmFtZSA9PT0gYi5ub2RlTmFtZSkgJiZcbiAgICAgICAgICBlcXVhbChnZXRBdHRyaWJ1dGVzKGEpLCBnZXRBdHRyaWJ1dGVzKGIpKSAmJlxuICAgICAgICAgIGVxdWFsKGEuY2hpbGROb2RlcywgYi5jaGlsZE5vZGVzKVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgdmFyIGVsZW1lbnROYW1lID0gZWxlbWVudC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgc3RhcnRUYWcgPSBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KTtcblxuICAgICAgICBvdXRwdXQuY29kZShzdGFydFRhZywgJ2h0bWwnKTtcbiAgICAgICAgaWYgKGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgaWYgKGRlcHRoID09PSAxKSB7XG4gICAgICAgICAgICBvdXRwdXQudGV4dCgnLi4uJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBpbnNwZWN0ZWRDaGlsZHJlbiA9IFtdO1xuICAgICAgICAgICAgaWYgKGVsZW1lbnROYW1lID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgICB2YXIgdHlwZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJyk7XG4gICAgICAgICAgICAgIGlmICghdHlwZSB8fCAvamF2YXNjcmlwdC8udGVzdCh0eXBlKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnamF2YXNjcmlwdCc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChcbiAgICAgICAgICAgICAgICBvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIHR5cGUpXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnROYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2goXG4gICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAuY2xvbmUoKVxuICAgICAgICAgICAgICAgICAgLmNvZGUoXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQudGV4dENvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJykgfHwgJ3RleHQvY3NzJ1xuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKGluc3BlY3QoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdpZHRoID0gc3RhcnRUYWcubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgICAgICAgdmFyIHNpemUgPSBvLnNpemUoKTtcbiAgICAgICAgICAgICAgd2lkdGggKz0gc2l6ZS53aWR0aDtcbiAgICAgICAgICAgICAgcmV0dXJuIHdpZHRoID4gNjAgfHwgby5oZWlnaHQgPiAxO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChtdWx0aXBsZUxpbmVzKSB7XG4gICAgICAgICAgICAgIG91dHB1dC5ubCgpLmluZGVudExpbmVzKCk7XG5cbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5pKClcbiAgICAgICAgICAgICAgICAgIC5ibG9jayhpbnNwZWN0ZWRDaGlsZClcbiAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICBvdXRwdXQub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdGVkQ2hpbGQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIGRpZmZMaW1pdDogNTEyLFxuICAgICAgZGlmZjogZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoYWN0dWFsKTtcbiAgICAgICAgb3V0cHV0LmlubGluZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCkgPiB0aGlzLmRpZmZMaW1pdCkge1xuICAgICAgICAgIG91dHB1dC5qc0NvbW1lbnQoJ0RpZmYgc3VwcHJlc3NlZCBkdWUgdG8gc2l6ZSA+ICcgKyB0aGlzLmRpZmZMaW1pdCk7XG4gICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbXB0eUVsZW1lbnRzID1cbiAgICAgICAgICBhY3R1YWwuY2hpbGROb2Rlcy5sZW5ndGggPT09IDAgJiYgZXhwZWN0ZWQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDA7XG4gICAgICAgIHZhciBjb25mbGljdGluZ0VsZW1lbnQgPVxuICAgICAgICAgIGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIHx8XG4gICAgICAgICAgIWVxdWFsKGdldEF0dHJpYnV0ZXMoYWN0dWFsKSwgZ2V0QXR0cmlidXRlcyhleHBlY3RlZCkpO1xuXG4gICAgICAgIGlmIChjb25mbGljdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgICB2YXIgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPCcpLnByaXNtVGFnKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAhPT0gZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlJylcbiAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAucHJpc21UYWcoZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBhY3R1YWxBdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhhY3R1YWwpO1xuICAgICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZXMgPSBnZXRBdHRyaWJ1dGVzKGV4cGVjdGVkKTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhhY3R1YWxBdHRyaWJ1dGVzKS5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgIG91dHB1dC5zcChjYW5Db250aW51ZUxpbmUgPyAxIDogMiArIGFjdHVhbC5ub2RlTmFtZS5sZW5ndGgpO1xuICAgICAgICAgICAgd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKFxuICAgICAgICAgICAgICBvdXRwdXQsXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICAgIGFjdHVhbEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0sXG4gICAgICAgICAgICAgIGlzSHRtbFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVOYW1lIGluIGV4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgYWN0dWFsQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9PT1cbiAgICAgICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV1cbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgZXF1YWwnKVxuICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3BlY3QoZW50aXRpZnkoZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdKSlcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgYmUgcmVtb3ZlZCcpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoY2FuQ29udGludWVMaW5lID8gMSA6IDIgKyBhY3R1YWwubm9kZU5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ21pc3NpbmcnKS5zcCgpO1xuICAgICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihcbiAgICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLFxuICAgICAgICAgICAgICAgICAgaXNIdG1sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeVN0YXJ0VGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVtcHR5RWxlbWVudHMpIHtcbiAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAuaW5kZW50TGluZXMoKVxuICAgICAgICAgICAgLmkoKVxuICAgICAgICAgICAgLmJsb2NrKFxuICAgICAgICAgICAgICBkaWZmKFxuICAgICAgICAgICAgICAgIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGFjdHVhbC5jaGlsZE5vZGVzKSxcbiAgICAgICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChleHBlY3RlZC5jaGlsZE5vZGVzKVxuICAgICAgICAgICAgICApLmRpZmZcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAub3V0ZGVudExpbmVzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIGhhdmUgKGNsYXNzfGNsYXNzZXMpIDxhcnJheXxzdHJpbmc+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywgeyBjbGFzczogdmFsdWUgfSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIG9ubHkgaGF2ZSAoY2xhc3N8Y2xhc3NlcykgPGFycmF5fHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBoYXZlIGF0dHJpYnV0ZXMnLCB7XG4gICAgICAgICAgY2xhc3M6IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB2YWx1ZSA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KGFjdHVhbENsYXNzZXMuc29ydCgpLCAndG8gZXF1YWwnLCB2YWx1ZS5zb3J0KCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTVRleHROb2RlPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5ub2RlVmFsdWUsICd0byBlcXVhbCcsIHZhbHVlLm5vZGVWYWx1ZSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUNvbW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTUNvbW1lbnQ+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0Lm5vZGVWYWx1ZSwgJ3RvIGVxdWFsJywgdmFsdWUubm9kZVZhbHVlKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQXZvaWQgcmVuZGVyaW5nIGEgaHVnZSBvYmplY3QgZGlmZiB3aGVuIGEgdGV4dCBub2RlIGlzIG1hdGNoZWQgYWdhaW5zdCBhIGRpZmZlcmVudCBub2RlIHR5cGU6XG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPG9iamVjdD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICBleHBlY3QuZmFpbCgpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBbHdheXMgcGFzc2VzOlxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAvLyBOYW1lIGVhY2ggc3ViamVjdCB0eXBlIHRvIGluY3JlYXNlIHRoZSBzcGVjaWZpY2l0eSBvZiB0aGUgYXNzZXJ0aW9uXG4gICAgICAnPERPTUNvbW1lbnR8RE9NRWxlbWVudHxET01UZXh0Tm9kZXxET01Eb2N1bWVudHxIVE1MRG9jVHlwZT4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NSWdub3JlQ29tbWVudD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge31cbiAgICApO1xuXG4gICAgLy8gTmVjZXNzYXJ5IGJlY2F1c2UgdGhpcyBjYXNlIHdvdWxkIG90aGVyd2lzZSBiZSBoYW5kbGVkIGJ5IHRoZSBhYm92ZSBjYXRjaC1hbGwgZm9yIDxvYmplY3Q+OlxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxyZWdleHA+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0Lm5vZGVWYWx1ZSwgJ3RvIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxhbnk+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0Lm5vZGVWYWx1ZSwgJ3RvIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGZ1bmN0aW9uIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhub2RlLCBpc0h0bWwpIHtcbiAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSAxMCkge1xuICAgICAgICAvLyBIVE1MRG9jVHlwZVxuICAgICAgICByZXR1cm4geyBuYW1lOiBub2RlLm5vZGVOYW1lIH07XG4gICAgICB9IGVsc2UgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEpIHtcbiAgICAgICAgLy8gRE9NRWxlbWVudFxuICAgICAgICB2YXIgbmFtZSA9IGlzSHRtbCA/IG5vZGUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IG5vZGUubm9kZU5hbWU7XG5cbiAgICAgICAgaWYgKG5hbWUgPT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgLy8gSWdub3JlIHN1YnRyZWVcbiAgICAgICAgICByZXR1cm4gZXhwZWN0Lml0KCd0byBiZSBhbicsICdET01Ob2RlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVzdWx0ID0geyBuYW1lOiBuYW1lIH07XG5cbiAgICAgICAgaWYgKG5vZGUuYXR0cmlidXRlcykge1xuICAgICAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmF0dHJpYnV0ZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzW25vZGUuYXR0cmlidXRlc1tpXS5uYW1lXSA9XG4gICAgICAgICAgICAgIGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUobm9kZS5hdHRyaWJ1dGVzW2ldLm5hbWUpXG4gICAgICAgICAgICAgICAgPyB0cnVlXG4gICAgICAgICAgICAgICAgOiBub2RlLmF0dHJpYnV0ZXNbaV0udmFsdWUgfHwgJyc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChub2RlLmNoaWxkTm9kZXMsIGZ1bmN0aW9uKFxuICAgICAgICAgIGNoaWxkTm9kZVxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGVsc2UgaWYgKG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgLy8gRE9NVGV4dE5vZGVcbiAgICAgICAgcmV0dXJuIG5vZGUubm9kZVZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSA4KSB7XG4gICAgICAgIC8vIERPTUNvbW1lbnRcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ3RvIHNhdGlzZnk6IE5vZGUgdHlwZSAnICtcbiAgICAgICAgICAgIG5vZGUubm9kZVR5cGUgK1xuICAgICAgICAgICAgJyBpcyBub3QgeWV0IHN1cHBvcnRlZCBpbiB0aGUgdmFsdWUnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NTm9kZUxpc3Q+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgICAgZXhwZWN0LmFyZ3NPdXRwdXQgPSBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUodmFsdWUsIGlzSHRtbCA/ICdodG1sJyA6ICd4bWwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBzdWJqZWN0LFxuICAgICAgICAgICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JyxcbiAgICAgICAgICAoaXNIdG1sXG4gICAgICAgICAgICA/IHBhcnNlSHRtbCh2YWx1ZSwgdHJ1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbilcbiAgICAgICAgICAgIDogcGFyc2VYbWwodmFsdWUsIGV4cGVjdC50ZXN0RGVzY3JpcHRpb24pXG4gICAgICAgICAgKS5jaGlsZE5vZGVzXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTU5vZGVMaXN0PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01Ob2RlTGlzdD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgICAgdmFyIHNhdGlzZnlTcGVjcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgc2F0aXNmeVNwZWNzLnB1c2goY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlW2ldLCBpc0h0bWwpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5Jywgc2F0aXNmeVNwZWNzKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnRGcmFnbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8c3RyaW5nPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgICAgZXhwZWN0LmFyZ3NPdXRwdXQgPSBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUodmFsdWUsIGlzSHRtbCA/ICdodG1sJyA6ICd4bWwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBzdWJqZWN0LFxuICAgICAgICAgICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JyxcbiAgICAgICAgICBpc0h0bWxcbiAgICAgICAgICAgID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlLCBleHBlY3QudGVzdERlc2NyaXB0aW9uKVxuICAgICAgICAgICAgOiBwYXJzZVhtbCh2YWx1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbilcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnRGcmFnbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NRG9jdW1lbnRGcmFnbWVudD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBzdWJqZWN0LFxuICAgICAgICAgICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JyxcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodmFsdWUuY2hpbGROb2RlcywgZnVuY3Rpb24oY2hpbGROb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01Eb2N1bWVudEZyYWdtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxvYmplY3R8YXJyYXk+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LmNoaWxkTm9kZXMsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgdmFsdWUpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01FbGVtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxzdHJpbmc+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuICAgICAgICB2YXIgZG9jdW1lbnRGcmFnbWVudCA9IGlzSHRtbFxuICAgICAgICAgID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbilcbiAgICAgICAgICA6IHBhcnNlWG1sKHZhbHVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbik7XG4gICAgICAgIGlmIChkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ0hUTUxFbGVtZW50IHRvIHNhdGlzZnkgc3RyaW5nOiBPbmx5IGEgc2luZ2xlIG5vZGUgaXMgc3VwcG9ydGVkJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZXhwZWN0LmFyZ3NPdXRwdXQgPSBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUodmFsdWUsIGlzSHRtbCA/ICdodG1sJyA6ICd4bWwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICBzdWJqZWN0LFxuICAgICAgICAgICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JyxcbiAgICAgICAgICBkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXNbMF1cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICAgIHZhciB2YWx1ZURvY3VtZW50ID0gaXNIdG1sXG4gICAgICAgICAgPyBwYXJzZUh0bWwodmFsdWUsIGZhbHNlLCB0aGlzLnRlc3REZXNjcmlwdGlvbilcbiAgICAgICAgICA6IHBhcnNlWG1sKHZhbHVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbik7XG4gICAgICAgIHJldHVybiBleHBlY3QoXG4gICAgICAgICAgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3Qoc3ViamVjdC5jaGlsZE5vZGVzKSxcbiAgICAgICAgICAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsXG4gICAgICAgICAgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHZhbHVlRG9jdW1lbnQuY2hpbGROb2RlcywgZnVuY3Rpb24oXG4gICAgICAgICAgICBjaGlsZE5vZGVcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMoY2hpbGROb2RlLCBpc0h0bWwpO1xuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTURvY3VtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01Eb2N1bWVudD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICAgIHJldHVybiBleHBlY3QoXG4gICAgICAgICAgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3Qoc3ViamVjdC5jaGlsZE5vZGVzKSxcbiAgICAgICAgICAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsXG4gICAgICAgICAgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHZhbHVlLmNoaWxkTm9kZXMsIGZ1bmN0aW9uKGNoaWxkTm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NRWxlbWVudD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLFxuICAgICAgICAgIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyh2YWx1ZSwgaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCkpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTVRleHROb2RlPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIGV4cGVjdC5mYWlsKCk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01FbGVtZW50PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIGV4cGVjdC5mYWlsKCk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnR8RE9NRG9jdW1lbnRGcmFnbWVudHxET01Eb2N1bWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8cmVnZXhwPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIGV4cGVjdC5mYWlsKCk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPG9iamVjdD4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICAgIHZhciB1bnN1cHBvcnRlZE9wdGlvbnMgPSBPYmplY3Qua2V5cyh2YWx1ZSkuZmlsdGVyKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBrZXkgIT09ICdhdHRyaWJ1dGVzJyAmJlxuICAgICAgICAgICAga2V5ICE9PSAnbmFtZScgJiZcbiAgICAgICAgICAgIGtleSAhPT0gJ2NoaWxkcmVuJyAmJlxuICAgICAgICAgICAga2V5ICE9PSAnb25seUF0dHJpYnV0ZXMnICYmXG4gICAgICAgICAgICBrZXkgIT09ICd0ZXh0Q29udGVudCdcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHVuc3VwcG9ydGVkT3B0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ1Vuc3VwcG9ydGVkIG9wdGlvbicgK1xuICAgICAgICAgICAgICAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnKSArXG4gICAgICAgICAgICAgICc6ICcgK1xuICAgICAgICAgICAgICB1bnN1cHBvcnRlZE9wdGlvbnMuam9pbignLCAnKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcHJvbWlzZUJ5S2V5ID0ge1xuICAgICAgICAgIG5hbWU6IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZS5uYW1lICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICAgICAgICAgIGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWUsXG4gICAgICAgICAgICAgICAgICAndG8gc2F0aXNmeScsXG4gICAgICAgICAgICAgICAgICB2YWx1ZS5uYW1lXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICAgY2hpbGRyZW46IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5jaGlsZHJlbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS50ZXh0Q29udGVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAnVGhlIGNoaWxkcmVuIGFuZCB0ZXh0Q29udGVudCBwcm9wZXJ0aWVzIGFyZSBub3Qgc3VwcG9ydGVkIHRvZ2V0aGVyJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3QoXG4gICAgICAgICAgICAgICAgICBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChcbiAgICAgICAgICAgICAgICAgICAgc3ViamVjdC5jaGlsZE5vZGVzLFxuICAgICAgICAgICAgICAgICAgICBzdWJqZWN0Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGVcbiAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAndG8gc2F0aXNmeScsXG4gICAgICAgICAgICAgICAgICB2YWx1ZS5jaGlsZHJlblxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUudGV4dENvbnRlbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgICAgICAgICAgc3ViamVjdC50ZXh0Q29udGVudCxcbiAgICAgICAgICAgICAgICAgICd0byBzYXRpc2Z5JyxcbiAgICAgICAgICAgICAgICAgIHZhbHVlLnRleHRDb250ZW50XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICAgYXR0cmlidXRlczoge31cbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgb25seUF0dHJpYnV0ZXMgPVxuICAgICAgICAgICh2YWx1ZSAmJiB2YWx1ZS5vbmx5QXR0cmlidXRlcykgfHwgZXhwZWN0LmZsYWdzLmV4aGF1c3RpdmVseTtcbiAgICAgICAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhzdWJqZWN0KTtcbiAgICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlcyA9IHZhbHVlICYmIHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzID0gW107XG5cbiAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZXMgPSBbZXhwZWN0ZWRBdHRyaWJ1dGVzXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUgPSB7fTtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShleHBlY3RlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcyAmJlxuICAgICAgICAgICAgdHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyA9PT0gJ29iamVjdCdcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUgPSBleHBlY3RlZEF0dHJpYnV0ZXM7XG4gICAgICAgICAgfVxuICAgICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUpLmZvckVhY2goZnVuY3Rpb24oXG4gICAgICAgICAgICBhdHRyaWJ1dGVOYW1lXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLnB1c2goYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZVZhbHVlID0gc3ViamVjdC5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9XG4gICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgZXhwZWN0KHN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpLCAndG8gYmUgZmFsc2UnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc0VudW1lcmF0ZWRBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXhPZkVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZSA9IGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXNbXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lXG4gICAgICAgICAgICAgICAgXS5pbmRleE9mKGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgaWYgKGluZGV4T2ZFbnVtZXJhdGVkQXR0cmlidXRlVmFsdWUgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoJ0ludmFsaWQgZXhwZWN0ZWQgdmFsdWUgJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmRJbnNwZWN0ZWQoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50ZXh0KCcuIFN1cHBvcnRlZCB2YWx1ZXMgaW5jbHVkZTogJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmRJdGVtcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlc1thdHRyaWJ1dGVOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJywgJ1xuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGV4cGVjdChhdHRyaWJ1dGVWYWx1ZSwgJ3RvIHNhdGlzZnknLCBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgZXhwZWN0KHN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpLCAndG8gYmUgdHJ1ZScpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWUgPT09ICdjbGFzcycgJiZcbiAgICAgICAgICAgICAgICAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICAgICAgICBBcnJheS5pc0FycmF5KGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICB2YXIgYWN0dWFsQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVWYWx1ZVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkQ2xhc3NlcyA9IGV4cGVjdGVkQXR0cmlidXRlVmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZENsYXNzZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICBleHBlY3RlZENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKFxuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob25seUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdChcbiAgICAgICAgICAgICAgICAgICAgICBhY3R1YWxDbGFzc2VzLnNvcnQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAndG8gZXF1YWwnLFxuICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQ2xhc3Nlcy5zb3J0KClcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBpZiAoZXhwZWN0ZWRDbGFzc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdChleHBlY3RlZENsYXNzZXMsICd0byBiZSBlbXB0eScpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdC5hcHBseShcbiAgICAgICAgICAgICAgICAgICAgICBleHBlY3QsXG4gICAgICAgICAgICAgICAgICAgICAgW2FjdHVhbENsYXNzZXMsICd0byBjb250YWluJ10uY29uY2F0KGV4cGVjdGVkQ2xhc3NlcylcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkU3R5bGVPYmo7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9iaiA9IHN0eWxlU3RyaW5nVG9PYmplY3QoXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGVcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGV4cGVjdGVkU3R5bGVPYmogPSBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgICAgICAgICAgICAgIGF0dHJzLnN0eWxlLFxuICAgICAgICAgICAgICAgICAgICAgICd0byBleGhhdXN0aXZlbHkgc2F0aXNmeScsXG4gICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9ialxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdChhdHRycy5zdHlsZSwgJ3RvIHNhdGlzZnknLCBleHBlY3RlZFN0eWxlT2JqKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVWYWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgJ3RvIHNhdGlzZnknLFxuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVQcmVzZW5jZSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZCA9IFtdO1xuICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID09PVxuICAgICAgICAgICAgICAgICd1bmRlZmluZWQnXG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ25vdCB0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5wdXNoKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ3RvIGhhdmUga2V5JywgYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgIGV4cGVjdChcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhhdHRycykuc29ydCgpLFxuICAgICAgICAgICAgICAgICd0byBlcXVhbCcsXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkLnNvcnQoKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4cGVjdC5wcm9taXNlLmFsbChwcm9taXNlQnlLZXkpLmNhdWdodChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gZXhwZWN0LnByb21pc2Uuc2V0dGxlKHByb21pc2VCeUtleSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGV4cGVjdC5mYWlsKHtcbiAgICAgICAgICAgICAgZGlmZjogZnVuY3Rpb24ob3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5ibG9jayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBvdXRwdXQgPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgdmFyIHNlZW5FcnJvciA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc8JylcbiAgICAgICAgICAgICAgICAgICAgLnByaXNtVGFnKFxuICAgICAgICAgICAgICAgICAgICAgIGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWVcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIGlmIChwcm9taXNlQnlLZXkubmFtZS5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VlbkVycm9yID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWVFcnJvciA9IHByb21pc2VCeUtleS5uYW1lLnJlYXNvbigpO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIChuYW1lRXJyb3IgJiYgbmFtZUVycm9yLmdldExhYmVsKCkpIHx8ICdzaG91bGQgc2F0aXNmeSdcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChpbnNwZWN0KHZhbHVlLm5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB2YXIgaW5zcGVjdGVkQXR0cmlidXRlcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlT3V0cHV0ID0gb3V0cHV0LmNsb25lKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihcbiAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVPdXRwdXQsXG4gICAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICBhdHRyc1thdHRyaWJ1dGVOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICBpc0h0bWxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgIChwcm9taXNlICYmIHByb21pc2UuaXNGdWxmaWxsZWQoKSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAoIXByb21pc2UgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICghb25seUF0dHJpYnV0ZXMgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpICE9PSAtMSkpXG4gICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHNlZW5FcnJvciA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlT3V0cHV0LnNwKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdICE9PVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICd1bmRlZmluZWQnXG4gICAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQocHJvbWlzZS5yZWFzb24oKS5nZXRFcnJvck1lc3NhZ2UodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seUF0dHJpYnV0ZXMgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlIHJlbW92ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpbnNwZWN0ZWRBdHRyaWJ1dGVzLnB1c2goYXR0cmlidXRlT3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzdWJqZWN0Lmhhc0F0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCFwcm9taXNlIHx8IHByb21pc2UuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWVuRXJyb3IgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHByb21pc2UgJiYgcHJvbWlzZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhdHRyaWJ1dGVPdXRwdXQgPSBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsb25lKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmFubm90YXRpb25CbG9jayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdtaXNzaW5nJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJpc21BdHRyTmFtZShhdHRyaWJ1dGVOYW1lLCAnaHRtbCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gIT09XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChlcnIgJiYgZXJyLmdldExhYmVsKCkpIHx8ICdzaG91bGQgc2F0aXNmeSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3BlY3QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnNwZWN0ZWRBdHRyaWJ1dGVzLnB1c2goYXR0cmlidXRlT3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgaWYgKGluc3BlY3RlZEF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VlbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5pbmRlbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmJsb2NrKGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpbnNwZWN0ZWRBdHRyaWJ1dGVzLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0Lm5sKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vdXRkZW50TGluZXMoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnNwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaW5zcGVjdGVkQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VlbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSB0YWcgbmFtZSBtaXNtYXRjaGVkXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5ubCgpO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPicpO1xuICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuRXJyb3IgPVxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlQnlLZXkuY2hpbGRyZW4uaXNSZWplY3RlZCgpICYmXG4gICAgICAgICAgICAgICAgICAgIHByb21pc2VCeUtleS5jaGlsZHJlbi5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZHJlbkRpZmYgPSBjaGlsZHJlbkVycm9yLmdldERpZmYob3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuRGlmZiAmJiBjaGlsZHJlbkRpZmYuaW5saW5lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuaW5kZW50TGluZXMoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmkoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmJsb2NrKGNoaWxkcmVuRGlmZi5kaWZmKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm5sKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuaW5kZW50TGluZXMoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmkoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmJsb2NrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpIDwgc3ViamVjdC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpICs9IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKS5ubCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZChjaGlsZHJlbkVycm9yLmdldEVycm9yTWVzc2FnZSh0aGlzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0Lm5sKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3ViamVjdC5jaGlsZE5vZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKHN1YmplY3QpLCAnaHRtbCcpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG91dHB1dC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gdG8gW29ubHldIGhhdmUgKGF0dHJpYnV0ZXxhdHRyaWJ1dGVzKSA8c3RyaW5nKz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KFxuICAgICAgICAgIHN1YmplY3QsXG4gICAgICAgICAgJ3RvIFtvbmx5XSBoYXZlIGF0dHJpYnV0ZXMnLFxuICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMilcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRWxlbWVudD4gbm90IHRvIGhhdmUgKGF0dHJpYnV0ZXxhdHRyaWJ1dGVzKSA8YXJyYXk+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgdmFyIGF0dHJpYnV0ZXMgPSBnZXRBdHRyaWJ1dGVzKHN1YmplY3QpO1xuXG4gICAgICAgIHZhbHVlLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgIGRlbGV0ZSBhdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBvbmx5IGhhdmUgYXR0cmlidXRlcycsIGF0dHJpYnV0ZXMpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01FbGVtZW50PiBub3QgdG8gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpIDxzdHJpbmcrPicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBleHBlY3QoXG4gICAgICAgICAgc3ViamVjdCxcbiAgICAgICAgICAnbm90IHRvIGhhdmUgYXR0cmlidXRlcycsXG4gICAgICAgICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01FbGVtZW50PiB0byBbb25seV0gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpIDxhcnJheXxvYmplY3Q+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gc2F0aXNmeScsIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzOiB2YWx1ZSxcbiAgICAgICAgICBvbmx5QXR0cmlidXRlczogZXhwZWN0LmZsYWdzLm9ubHlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgICAnPERPTUVsZW1lbnQ+IHRvIGhhdmUgW25vXSAoY2hpbGR8Y2hpbGRyZW4pJyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgICBpZiAoZXhwZWN0LmZsYWdzLm5vKSB7XG4gICAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LmNoaWxkTm9kZXMsICd0byBiZSBlbXB0eScpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5jaGlsZE5vZGVzLCAnbm90IHRvIGJlIGVtcHR5Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIGhhdmUgdGV4dCA8YW55PicsIGZ1bmN0aW9uKFxuICAgICAgZXhwZWN0LFxuICAgICAgc3ViamVjdCxcbiAgICAgIHZhbHVlXG4gICAgKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QudGV4dENvbnRlbnQsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiBbd2hlbl0gcXVlcmllZCBmb3IgW2ZpcnN0XSA8c3RyaW5nPiA8YXNzZXJ0aW9uPz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSkge1xuICAgICAgICB2YXIgcXVlcnlSZXN1bHQ7XG5cbiAgICAgICAgZXhwZWN0LmFyZ3NPdXRwdXRbMF0gPSBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb3V0cHV0LmdyZWVuKHF1ZXJ5KTtcbiAgICAgICAgfTtcblxuICAgICAgICBleHBlY3QuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG5cbiAgICAgICAgaWYgKGV4cGVjdC5mbGFncy5maXJzdCkge1xuICAgICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHF1ZXJ5KTtcbiAgICAgICAgICBpZiAoIXF1ZXJ5UmVzdWx0KSB7XG4gICAgICAgICAgICBleHBlY3Quc3ViamVjdE91dHB1dCA9IGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgICAgICBleHBlY3QuaW5zcGVjdChzdWJqZWN0LCBJbmZpbml0eSwgb3V0cHV0KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBleHBlY3QuZmFpbChmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dFxuICAgICAgICAgICAgICAgIC5lcnJvcignVGhlIHNlbGVjdG9yJylcbiAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgIC5qc1N0cmluZyhxdWVyeSlcbiAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgIC5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcXVlcnlSZXN1bHQgPSBzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpO1xuICAgICAgICAgIGlmIChxdWVyeVJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGV4cGVjdC5zdWJqZWN0T3V0cHV0ID0gZnVuY3Rpb24ob3V0cHV0KSB7XG4gICAgICAgICAgICAgIGV4cGVjdC5pbnNwZWN0KHN1YmplY3QsIEluZmluaXR5LCBvdXRwdXQpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uKG91dHB1dCkge1xuICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0XG4gICAgICAgICAgICAgICAgLmVycm9yKCdUaGUgc2VsZWN0b3InKVxuICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgLmpzU3RyaW5nKHF1ZXJ5KVxuICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwZWN0LnNoaWZ0KHF1ZXJ5UmVzdWx0KTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbihcbiAgICAgICc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiB0byBjb250YWluIFtub10gZWxlbWVudHMgbWF0Y2hpbmcgPHN0cmluZz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSkge1xuICAgICAgICBpZiAoZXhwZWN0LmZsYWdzLm5vKSB7XG4gICAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpLCAndG8gc2F0aXNmeScsIFtdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdC5zdWJqZWN0T3V0cHV0ID0gZnVuY3Rpb24ob3V0cHV0KSB7XG4gICAgICAgICAgZXhwZWN0Lmluc3BlY3Qoc3ViamVjdCwgSW5maW5pdHksIG91dHB1dCk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KSwgJ25vdCB0byBzYXRpc2Z5JywgW10pO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxET01Eb2N1bWVudHxET01FbGVtZW50fERPTURvY3VtZW50RnJhZ21lbnQ+IFtub3RdIHRvIG1hdGNoIDxzdHJpbmc+JyxcbiAgICAgIGZ1bmN0aW9uKGV4cGVjdCwgc3ViamVjdCwgcXVlcnkpIHtcbiAgICAgICAgZXhwZWN0LnN1YmplY3RPdXRwdXQgPSBmdW5jdGlvbihvdXRwdXQpIHtcbiAgICAgICAgICBleHBlY3QuaW5zcGVjdChzdWJqZWN0LCBJbmZpbml0eSwgb3V0cHV0KTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChtYXRjaGVzU2VsZWN0b3Ioc3ViamVjdCwgcXVlcnkpLCAnW25vdF0gdG8gYmUgdHJ1ZScpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxzdHJpbmc+IFt3aGVuXSBwYXJzZWQgYXMgKGh0bWx8SFRNTCkgW2ZyYWdtZW50XSA8YXNzZXJ0aW9uPz4nLFxuICAgICAgZnVuY3Rpb24oZXhwZWN0LCBzdWJqZWN0KSB7XG4gICAgICAgIGV4cGVjdC5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgcmV0dXJuIGV4cGVjdC5zaGlmdChcbiAgICAgICAgICBwYXJzZUh0bWwoc3ViamVjdCwgZXhwZWN0LmZsYWdzLmZyYWdtZW50LCBleHBlY3QudGVzdERlc2NyaXB0aW9uKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKFxuICAgICAgJzxzdHJpbmc+IFt3aGVuXSBwYXJzZWQgYXMgKHhtbHxYTUwpIDxhc3NlcnRpb24/PicsXG4gICAgICBmdW5jdGlvbihleHBlY3QsIHN1YmplY3QpIHtcbiAgICAgICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgICByZXR1cm4gZXhwZWN0LnNoaWZ0KHBhcnNlWG1sKHN1YmplY3QsIGV4cGVjdC50ZXN0RGVzY3JpcHRpb24pKTtcbiAgICAgIH1cbiAgICApO1xuICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbG0sIHNlbGVjdG9yKSB7XG4gIHZhciBtYXRjaEZ1bnRpb24gPVxuICAgIGVsbS5tYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ubW96TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxtLm1zTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxtLm9NYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ud2Via2l0TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICAgIHZhciBub2RlID0gdGhpcztcbiAgICAgIHZhciBub2RlcyA9IChub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5kb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICB2YXIgaSA9IDA7XG5cbiAgICAgIHdoaWxlIChub2Rlc1tpXSAmJiBub2Rlc1tpXSAhPT0gbm9kZSkge1xuICAgICAgICBpICs9IDE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAhIW5vZGVzW2ldO1xuICAgIH07XG5cbiAgcmV0dXJuIG1hdGNoRnVudGlvbi5jYWxsKGVsbSwgc2VsZWN0b3IpO1xufTtcbiIsInZhciBvbGRQcmlzbUdsb2JhbCA9IGdsb2JhbC5QcmlzbTtcbnZhciBwcmlzbSA9IGdsb2JhbC5QcmlzbSA9IHJlcXVpcmUoJ3ByaXNtanMnKTtcbnJlcXVpcmUoJ3ByaXNtanMvY29tcG9uZW50cy9wcmlzbS1ncmFwaHFsLmpzJyk7XG5yZXF1aXJlKCdwcmlzbWpzL2NvbXBvbmVudHMvcHJpc20tY3NwLmpzJyk7XG5nbG9iYWwuUHJpc20gPSBvbGRQcmlzbUdsb2JhbDtcblxudmFyIGRlZmF1bHRUaGVtZSA9IHtcbiAgICAvLyBBZGFwdGVkIGZyb20gdGhlIGRlZmF1bHQgUHJpc20gdGhlbWU6XG4gICAgcHJpc21Db21tZW50OiAnIzcwODA5MCcsIC8vIHNsYXRlZ3JheVxuICAgIHByaXNtUHJvbG9nOiAncHJpc21Db21tZW50JyxcbiAgICBwcmlzbURvY3R5cGU6ICdwcmlzbUNvbW1lbnQnLFxuICAgIHByaXNtQ2RhdGE6ICdwcmlzbUNvbW1lbnQnLFxuXG4gICAgcHJpc21QdW5jdHVhdGlvbjogJyM5OTknLFxuXG4gICAgcHJpc21TeW1ib2w6ICcjOTA1JyxcbiAgICBwcmlzbVByb3BlcnR5OiAncHJpc21TeW1ib2wnLFxuICAgIHByaXNtVGFnOiAncHJpc21TeW1ib2wnLFxuICAgIHByaXNtQm9vbGVhbjogJ3ByaXNtU3ltYm9sJyxcbiAgICBwcmlzbU51bWJlcjogJ3ByaXNtU3ltYm9sJyxcbiAgICBwcmlzbUNvbnN0YW50OiAncHJpc21TeW1ib2wnLFxuICAgIHByaXNtRGVsZXRlZDogJ3ByaXNtU3ltYm9sJyxcblxuICAgIHByaXNtU3RyaW5nOiAnIzY5MCcsXG4gICAgcHJpc21TZWxlY3RvcjogJ3ByaXNtU3RyaW5nJyxcbiAgICBwcmlzbUF0dHJOYW1lOiAncHJpc21TdHJpbmcnLFxuICAgIHByaXNtQ2hhcjogJ3ByaXNtU3RyaW5nJyxcbiAgICBwcmlzbUJ1aWx0aW46ICdwcmlzbVN0cmluZycsXG4gICAgcHJpc21JbnNlcnRlZDogJ3ByaXNtU3RyaW5nJyxcblxuICAgIHByaXNtT3BlcmF0b3I6ICcjYTY3ZjU5JyxcbiAgICBwcmlzbVZhcmlhYmxlOiAncHJpc21PcGVyYXRvcicsXG4gICAgcHJpc21FbnRpdHk6ICdwcmlzbU9wZXJhdG9yJyxcbiAgICBwcmlzbVVybDogJ3ByaXNtT3BlcmF0b3InLFxuICAgIHByaXNtQ3NzU3RyaW5nOiAncHJpc21PcGVyYXRvcicsXG5cbiAgICBwcmlzbUtleXdvcmQ6ICcjMDdhJyxcbiAgICBwcmlzbUF0cnVsZTogJ3ByaXNtS2V5d29yZCcsXG4gICAgcHJpc21BdHRyVmFsdWU6ICdwcmlzbUtleXdvcmQnLFxuXG4gICAgcHJpc21GdW5jdGlvbjogJyNERDRBNjgnLFxuXG4gICAgcHJpc21SZWdleDogJyNlOTAnLFxuICAgIHByaXNtSW1wb3J0YW50OiBbJyNlOTAnLCAnYm9sZCddXG59O1xuXG52YXIgbGFuZ3VhZ2VNYXBwaW5nID0ge1xuICAgICd0ZXh0L2h0bWwnOiAnbWFya3VwJyxcbiAgICAnYXBwbGljYXRpb24veG1sJzogJ21hcmt1cCcsXG4gICAgJ3RleHQveG1sJzogJ21hcmt1cCcsXG4gICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnamF2YXNjcmlwdCcsXG4gICAgJ3RleHQvamF2YXNjcmlwdCc6ICdqYXZhc2NyaXB0JyxcbiAgICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCc6ICdqYXZhc2NyaXB0JyxcbiAgICAndGV4dC9jc3MnOiAnY3NzJyxcbiAgICBodG1sOiAnbWFya3VwJyxcbiAgICB4bWw6ICdtYXJrdXAnLFxuICAgIGM6ICdjbGlrZScsXG4gICAgJ2MrKyc6ICdjbGlrZScsXG4gICAgJ2NwcCc6ICdjbGlrZScsXG4gICAgJ2MjJzogJ2NsaWtlJyxcbiAgICBqYXZhOiAnY2xpa2UnLFxuICAgICdhcHBsaWNhdGlvbi9ncmFwaHFsJzogJ2dyYXBocWwnXG59O1xuXG5mdW5jdGlvbiB1cHBlckNhbWVsQ2FzZShzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyg/Ol58LSkoW2Etel0pL2csIGZ1bmN0aW9uICgkMCwgY2gpIHtcbiAgICAgICAgcmV0dXJuIGNoLnRvVXBwZXJDYXNlKCk7XG4gICAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIG5hbWU6ICdtYWdpY3Blbi1wcmlzbScsXG4gICAgdmVyc2lvbjogcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJykudmVyc2lvbixcbiAgICBpbnN0YWxsSW50bzogZnVuY3Rpb24gKG1hZ2ljUGVuKSB7XG4gICAgICAgIG1hZ2ljUGVuLmluc3RhbGxUaGVtZShkZWZhdWx0VGhlbWUpO1xuXG4gICAgICAgIG1hZ2ljUGVuLmFkZFN0eWxlKCdjb2RlJywgZnVuY3Rpb24gKHNvdXJjZVRleHQsIGxhbmd1YWdlKSB7XG4gICAgICAgICAgICBpZiAobGFuZ3VhZ2UgaW4gbGFuZ3VhZ2VNYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2UgPSBsYW5ndWFnZU1hcHBpbmdbbGFuZ3VhZ2VdO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgvXFwreG1sXFxiLy50ZXN0KGxhbmd1YWdlKSkge1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlID0gJ21hcmt1cCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShsYW5ndWFnZSBpbiBwcmlzbS5sYW5ndWFnZXMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudGV4dChzb3VyY2VUZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIGNhcGl0YWxpemVkTGFuZ3VhZ2UgPSB1cHBlckNhbWVsQ2FzZShsYW5ndWFnZSk7XG4gICAgICAgICAgICB2YXIgbGFuZ3VhZ2VEZWZpbml0aW9uID0gcHJpc20ubGFuZ3VhZ2VzW2xhbmd1YWdlXTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gcHJpbnRUb2tlbnModG9rZW4sIHBhcmVudFN0eWxlKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodG9rZW4pKSB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuLmZvckVhY2goZnVuY3Rpb24gKHN1YlRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmludFRva2VucyhzdWJUb2tlbiwgcGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlID0gdXBwZXJDYW1lbENhc2UocGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHRva2VuLnJlcGxhY2UoLyZsdDsvZywgJzwnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0odG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoYXRbJ3ByaXNtJyArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdFsncHJpc20nICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKHRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsYW5ndWFnZURlZmluaXRpb25bcGFyZW50U3R5bGVdICYmIGxhbmd1YWdlRGVmaW5pdGlvbltwYXJlbnRTdHlsZV0uYWxpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW50VG9rZW5zKHRva2VuLCBsYW5ndWFnZURlZmluaXRpb25bcGFyZW50U3R5bGVdLmFsaWFzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudGV4dCh0b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcmludFRva2Vucyh0b2tlbi5jb250ZW50LCB0b2tlbi50eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmludFRva2VucyhwcmlzbS50b2tlbml6ZShzb3VyY2VUZXh0LCBwcmlzbS5sYW5ndWFnZXNbbGFuZ3VhZ2VdKSwgJ3RleHQnKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJfZnJvbVwiOiBcIm1hZ2ljcGVuLXByaXNtQF4yLjMuMFwiLFxuICBcIl9pZFwiOiBcIm1hZ2ljcGVuLXByaXNtQDIuNC4wXCIsXG4gIFwiX2luQnVuZGxlXCI6IGZhbHNlLFxuICBcIl9pbnRlZ3JpdHlcIjogXCJzaGE1MTItT0VGWit4a3NKdFlnd25VNWpKcURYaGp2Z25TRmZNc1NnWHBKMldXUGFCSlVYTkt1UUIwRkJBaVF4alJLc1Y1Z250cGcvdGF6SDhMM2FwSng1ZU1kSmc9PVwiLFxuICBcIl9sb2NhdGlvblwiOiBcIi9tYWdpY3Blbi1wcmlzbVwiLFxuICBcIl9waGFudG9tQ2hpbGRyZW5cIjoge30sXG4gIFwiX3JlcXVlc3RlZFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwicmFuZ2VcIixcbiAgICBcInJlZ2lzdHJ5XCI6IHRydWUsXG4gICAgXCJyYXdcIjogXCJtYWdpY3Blbi1wcmlzbUBeMi4zLjBcIixcbiAgICBcIm5hbWVcIjogXCJtYWdpY3Blbi1wcmlzbVwiLFxuICAgIFwiZXNjYXBlZE5hbWVcIjogXCJtYWdpY3Blbi1wcmlzbVwiLFxuICAgIFwicmF3U3BlY1wiOiBcIl4yLjMuMFwiLFxuICAgIFwic2F2ZVNwZWNcIjogbnVsbCxcbiAgICBcImZldGNoU3BlY1wiOiBcIl4yLjMuMFwiXG4gIH0sXG4gIFwiX3JlcXVpcmVkQnlcIjogW1xuICAgIFwiL1wiLFxuICAgIFwiL3VuZXhwZWN0ZWQtbWFya2Rvd25cIlxuICBdLFxuICBcIl9yZXNvbHZlZFwiOiBcImh0dHBzOi8vcmVnaXN0cnkubnBtanMub3JnL21hZ2ljcGVuLXByaXNtLy0vbWFnaWNwZW4tcHJpc20tMi40LjAudGd6XCIsXG4gIFwiX3NoYXN1bVwiOiBcImFhNzljYTliNjU2ZjM1MDY5YWQwYWVhOGIxMDJmMWFjODY0MmNiYjBcIixcbiAgXCJfc3BlY1wiOiBcIm1hZ2ljcGVuLXByaXNtQF4yLjMuMFwiLFxuICBcIl93aGVyZVwiOiBcIi9Vc2Vycy9zc2ltb25zZW4vQ29kZS91bmV4cGVjdGVkLWRvbVwiLFxuICBcImF1dGhvclwiOiB7XG4gICAgXCJuYW1lXCI6IFwiQW5kcmVhcyBMaW5kXCIsXG4gICAgXCJlbWFpbFwiOiBcImFuZHJlYXNAb25lLmNvbVwiXG4gIH0sXG4gIFwiYnVnc1wiOiB7XG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vdW5leHBlY3RlZGpzL21hZ2ljcGVuLXByaXNtL2lzc3Vlc1wiXG4gIH0sXG4gIFwiYnVuZGxlRGVwZW5kZW5jaWVzXCI6IGZhbHNlLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJwcmlzbWpzXCI6IFwiMS4xMS4wXCJcbiAgfSxcbiAgXCJkZXByZWNhdGVkXCI6IGZhbHNlLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiQWRkIHN5bnRheCBoaWdobGlnaHRpbmcgc3VwcG9ydCB0byBtYWdpY3BlbiB2aWEgcHJpc20uanNcIixcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYnJvd3NlcmlmeVwiOiBcIjEzLjAuMFwiLFxuICAgIFwiYnVuZGxlLWNvbGxhcHNlclwiOiBcIjEuMi4xXCIsXG4gICAgXCJlc2xpbnRcIjogXCIyLjEzLjFcIixcbiAgICBcImVzbGludC1jb25maWctb25lbGludFwiOiBcIjEuMi4wXCIsXG4gICAgXCJtYWdpY3BlblwiOiBcIjUuOS4wXCIsXG4gICAgXCJtb2NoYVwiOiBcIjIuNC41XCIsXG4gICAgXCJ1bmV4cGVjdGVkXCI6IFwiMTAuMTAuNVwiXG4gIH0sXG4gIFwiZmlsZXNcIjogW1xuICAgIFwibGliXCIsXG4gICAgXCJtYWdpY1BlblByaXNtLm1pbi5qc1wiXG4gIF0sXG4gIFwiaG9tZXBhZ2VcIjogXCJodHRwczovL2dpdGh1Yi5jb20vdW5leHBlY3RlZGpzL21hZ2ljcGVuLXByaXNtI3JlYWRtZVwiLFxuICBcIm1haW5cIjogXCJsaWIvbWFnaWNQZW5QcmlzbS5qc1wiLFxuICBcIm5hbWVcIjogXCJtYWdpY3Blbi1wcmlzbVwiLFxuICBcInJlcG9zaXRvcnlcIjoge1xuICAgIFwidHlwZVwiOiBcImdpdFwiLFxuICAgIFwidXJsXCI6IFwiZ2l0K2h0dHBzOi8vZ2l0aHViLmNvbS91bmV4cGVjdGVkanMvbWFnaWNwZW4tcHJpc20uZ2l0XCJcbiAgfSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcImxpbnRcIjogXCJlc2xpbnQgLlwiLFxuICAgIFwicHJlcHVibGlzaFwiOiBcImJyb3dzZXJpZnkgLXAgYnVuZGxlLWNvbGxhcHNlci9wbHVnaW4gLWUgbGliL21hZ2ljUGVuUHJpc20gLXMgbWFnaWNQZW5QcmlzbSA+IG1hZ2ljUGVuUHJpc20ubWluLmpzXCIsXG4gICAgXCJ0ZXN0XCI6IFwibW9jaGFcIixcbiAgICBcInRyYXZpc1wiOiBcIm5wbSBydW4gbGludCAmJiBucG0gdGVzdFwiXG4gIH0sXG4gIFwidmVyc2lvblwiOiBcIjIuNC4wXCJcbn1cbiIsIi8qKlxuICogT3JpZ2luYWwgYnkgU2NvdHQgSGVsbWUuXG4gKlxuICogUmVmZXJlbmNlOiBodHRwczovL3Njb3R0aGVsbWUuY28udWsvY3NwLWNoZWF0LXNoZWV0L1xuICpcbiAqIFN1cHBvcnRzIHRoZSBmb2xsb3dpbmc6XG4gKiAgLSBDU1AgTGV2ZWwgMVxuICogIC0gQ1NQIExldmVsIDJcbiAqICAtIENTUCBMZXZlbCAzXG4gKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNzcCA9IHtcblx0J2RpcmVjdGl2ZSc6ICB7XG4gICAgICAgICAgICAgcGF0dGVybjogL1xcYig/Oig/OmJhc2UtdXJpfGZvcm0tYWN0aW9ufGZyYW1lLWFuY2VzdG9yc3xwbHVnaW4tdHlwZXN8cmVmZXJyZXJ8cmVmbGVjdGVkLXhzc3xyZXBvcnQtdG98cmVwb3J0LXVyaXxyZXF1aXJlLXNyaS1mb3J8c2FuZGJveCkgfCg/OmJsb2NrLWFsbC1taXhlZC1jb250ZW50fGRpc293bi1vcGVuZXJ8dXBncmFkZS1pbnNlY3VyZS1yZXF1ZXN0cykoPzogfDspfCg/OmNoaWxkfGNvbm5lY3R8ZGVmYXVsdHxmb250fGZyYW1lfGltZ3xtYW5pZmVzdHxtZWRpYXxvYmplY3R8c2NyaXB0fHN0eWxlfHdvcmtlciktc3JjICkvaSxcbiAgICAgICAgICAgICBhbGlhczogJ2tleXdvcmQnXG4gICAgICAgIH0sXG5cdCdzYWZlJzoge1xuICAgICAgICAgICAgcGF0dGVybjogLycoPzpzZWxmfG5vbmV8c3RyaWN0LWR5bmFtaWN8KD86bm9uY2UtfHNoYSg/OjI1NnwzODR8NTEyKS0pW2EtekEtWjAtOSs9L10rKScvLFxuICAgICAgICAgICAgYWxpYXM6ICdzZWxlY3RvcidcbiAgICAgICAgfSxcblx0J3Vuc2FmZSc6IHtcbiAgICAgICAgICAgIHBhdHRlcm46IC8oPzondW5zYWZlLWlubGluZSd8J3Vuc2FmZS1ldmFsJ3wndW5zYWZlLWhhc2hlZC1hdHRyaWJ1dGVzJ3xcXCopLyxcbiAgICAgICAgICAgIGFsaWFzOiAnZnVuY3Rpb24nXG4gICAgICAgIH1cbn07IiwiUHJpc20ubGFuZ3VhZ2VzLmdyYXBocWwgPSB7XG5cdCdjb21tZW50JzogLyMuKi8sXG5cdCdzdHJpbmcnOiB7XG5cdFx0cGF0dGVybjogL1wiKD86XFxcXC58W15cXFxcXCJcXHJcXG5dKSpcIi8sXG5cdFx0Z3JlZWR5OiB0cnVlXG5cdH0sXG5cdCdudW1iZXInOiAvKD86XFxCLXxcXGIpXFxkKyg/OlxcLlxcZCspPyg/OltlRV1bKy1dP1xcZCspP1xcYi8sXG5cdCdib29sZWFuJzogL1xcYig/OnRydWV8ZmFsc2UpXFxiLyxcblx0J3ZhcmlhYmxlJzogL1xcJFthLXpfXVxcdyovaSxcblx0J2RpcmVjdGl2ZSc6IHtcblx0XHRwYXR0ZXJuOiAvQFthLXpfXVxcdyovaSxcblx0XHRhbGlhczogJ2Z1bmN0aW9uJ1xuXHR9LFxuXHQnYXR0ci1uYW1lJzogL1thLXpfXVxcdyooPz1cXHMqOikvaSxcblx0J2tleXdvcmQnOiBbXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhmcmFnbWVudFxccysoPyFvbilbYS16X11cXHcqXFxzK3xcXC57M31cXHMqKW9uXFxiLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRcdC9cXGIoPzpxdWVyeXxmcmFnbWVudHxtdXRhdGlvbilcXGIvXG5cdF0sXG5cdCdvcGVyYXRvcic6IC8hfD18XFwuezN9Lyxcblx0J3B1bmN0dWF0aW9uJzogL1shKCl7fVxcW1xcXTo9LF0vXG59OyIsIlxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1jb3JlLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbnZhciBfc2VsZiA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJylcblx0PyB3aW5kb3cgICAvLyBpZiBpbiBicm93c2VyXG5cdDogKFxuXHRcdCh0eXBlb2YgV29ya2VyR2xvYmFsU2NvcGUgIT09ICd1bmRlZmluZWQnICYmIHNlbGYgaW5zdGFuY2VvZiBXb3JrZXJHbG9iYWxTY29wZSlcblx0XHQ/IHNlbGYgLy8gaWYgaW4gd29ya2VyXG5cdFx0OiB7fSAgIC8vIGlmIGluIG5vZGUganNcblx0KTtcblxuLyoqXG4gKiBQcmlzbTogTGlnaHR3ZWlnaHQsIHJvYnVzdCwgZWxlZ2FudCBzeW50YXggaGlnaGxpZ2h0aW5nXG4gKiBNSVQgbGljZW5zZSBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocC9cbiAqIEBhdXRob3IgTGVhIFZlcm91IGh0dHA6Ly9sZWEudmVyb3UubWVcbiAqL1xuXG52YXIgUHJpc20gPSAoZnVuY3Rpb24oKXtcblxuLy8gUHJpdmF0ZSBoZWxwZXIgdmFyc1xudmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oXFx3KylcXGIvaTtcbnZhciB1bmlxdWVJZCA9IDA7XG5cbnZhciBfID0gX3NlbGYuUHJpc20gPSB7XG5cdG1hbnVhbDogX3NlbGYuUHJpc20gJiYgX3NlbGYuUHJpc20ubWFudWFsLFxuXHRkaXNhYmxlV29ya2VyTWVzc2FnZUhhbmRsZXI6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLmRpc2FibGVXb3JrZXJNZXNzYWdlSGFuZGxlcixcblx0dXRpbDoge1xuXHRcdGVuY29kZTogZnVuY3Rpb24gKHRva2Vucykge1xuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgVG9rZW4odG9rZW5zLnR5cGUsIF8udXRpbC5lbmNvZGUodG9rZW5zLmNvbnRlbnQpLCB0b2tlbnMuYWxpYXMpO1xuXHRcdFx0fSBlbHNlIGlmIChfLnV0aWwudHlwZSh0b2tlbnMpID09PSAnQXJyYXknKSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRva2Vucy5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC9cXHUwMGEwL2csICcgJyk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLm1hdGNoKC9cXFtvYmplY3QgKFxcdyspXFxdLylbMV07XG5cdFx0fSxcblxuXHRcdG9iaklkOiBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRpZiAoIW9ialsnX19pZCddKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvYmpbJ19faWQnXTtcblx0XHR9LFxuXG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcblxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XG5cdFx0XHRcdFx0dmFyIGNsb25lID0ge307XG5cblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xuXHRcdFx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xuXG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHRyZXR1cm4gby5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gXy51dGlsLmNsb25lKHYpOyB9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG87XG5cdFx0fVxuXHR9LFxuXG5cdGxhbmd1YWdlczoge1xuXHRcdGV4dGVuZDogZnVuY3Rpb24gKGlkLCByZWRlZikge1xuXHRcdFx0dmFyIGxhbmcgPSBfLnV0aWwuY2xvbmUoXy5sYW5ndWFnZXNbaWRdKTtcblxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHJlZGVmKSB7XG5cdFx0XHRcdGxhbmdba2V5XSA9IHJlZGVmW2tleV07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBsYW5nO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcblx0XHQgKiBBcyB0aGlzIG5lZWRzIHRvIHJlY3JlYXRlIHRoZSBvYmplY3QgKHdlIGNhbm5vdCBhY3R1YWxseSBpbnNlcnQgYmVmb3JlIGtleXMgaW4gb2JqZWN0IGxpdGVyYWxzKSxcblx0XHQgKiB3ZSBjYW5ub3QganVzdCBwcm92aWRlIGFuIG9iamVjdCwgd2UgbmVlZCBhbm9iamVjdCBhbmQgYSBrZXkuXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxuXHRcdCAqIEBwYXJhbSBiZWZvcmUgVGhlIGtleSB0byBpbnNlcnQgYmVmb3JlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBmdW5jdGlvbiBhcHBlbmRzIGluc3RlYWQuXG5cdFx0ICogQHBhcmFtIGluc2VydCBPYmplY3Qgd2l0aCB0aGUga2V5L3ZhbHVlIHBhaXJzIHRvIGluc2VydFxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cblx0XHQgKi9cblx0XHRpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uIChpbnNpZGUsIGJlZm9yZSwgaW5zZXJ0LCByb290KSB7XG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xuXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XG5cdFx0XHRcdGluc2VydCA9IGFyZ3VtZW50c1sxXTtcblxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcblx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xuXHRcdFx0XHRcdFx0Z3JhbW1hcltuZXdUb2tlbl0gPSBpbnNlcnRbbmV3VG9rZW5dO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcmV0ID0ge307XG5cblx0XHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblxuXHRcdFx0XHRpZiAoZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcblxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cblx0XHRcdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXRbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgcmVmZXJlbmNlcyBpbiBvdGhlciBsYW5ndWFnZSBkZWZpbml0aW9uc1xuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gcm9vdFtpbnNpZGVdICYmIGtleSAhPSBpbnNpZGUpIHtcblx0XHRcdFx0XHR0aGlzW2tleV0gPSByZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xuXHRcdH0sXG5cblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrLCB0eXBlLCB2aXNpdGVkKSB7XG5cdFx0XHR2aXNpdGVkID0gdmlzaXRlZCB8fCB7fTtcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwobywgaSwgb1tpXSwgdHlwZSB8fCBpKTtcblxuXHRcdFx0XHRcdGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ09iamVjdCcgJiYgIXZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSkge1xuXHRcdFx0XHRcdFx0dmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldID0gdHJ1ZTtcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnQXJyYXknICYmICF2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIGksIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0cGx1Z2luczoge30sXG5cblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcblx0XHRfLmhpZ2hsaWdodEFsbFVuZGVyKGRvY3VtZW50LCBhc3luYywgY2FsbGJhY2spO1xuXHR9LFxuXG5cdGhpZ2hsaWdodEFsbFVuZGVyOiBmdW5jdGlvbihjb250YWluZXIsIGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdHZhciBlbnYgPSB7XG5cdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXG5cdFx0XHRzZWxlY3RvcjogJ2NvZGVbY2xhc3MqPVwibGFuZ3VhZ2UtXCJdLCBbY2xhc3MqPVwibGFuZ3VhZ2UtXCJdIGNvZGUsIGNvZGVbY2xhc3MqPVwibGFuZy1cIl0sIFtjbGFzcyo9XCJsYW5nLVwiXSBjb2RlJ1xuXHRcdH07XG5cblx0XHRfLmhvb2tzLnJ1bihcImJlZm9yZS1oaWdobGlnaHRhbGxcIiwgZW52KTtcblxuXHRcdHZhciBlbGVtZW50cyA9IGVudi5lbGVtZW50cyB8fCBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbChlbnYuc2VsZWN0b3IpO1xuXG5cdFx0Zm9yICh2YXIgaT0wLCBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudHNbaSsrXTspIHtcblx0XHRcdF8uaGlnaGxpZ2h0RWxlbWVudChlbGVtZW50LCBhc3luYyA9PT0gdHJ1ZSwgZW52LmNhbGxiYWNrKTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Ly8gRmluZCBsYW5ndWFnZVxuXHRcdHZhciBsYW5ndWFnZSwgZ3JhbW1hciwgcGFyZW50ID0gZWxlbWVudDtcblxuXHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcblx0XHRcdGdyYW1tYXIgPSBfLmxhbmd1YWdlc1tsYW5ndWFnZV07XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBlbGVtZW50LCBpZiBub3QgcHJlc2VudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cblx0XHRpZiAoZWxlbWVudC5wYXJlbnROb2RlKSB7XG5cdFx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcblx0XHRcdHBhcmVudCA9IGVsZW1lbnQucGFyZW50Tm9kZTtcblxuXHRcdFx0aWYgKC9wcmUvaS50ZXN0KHBhcmVudC5ub2RlTmFtZSkpIHtcblx0XHRcdFx0cGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dmFyIGNvZGUgPSBlbGVtZW50LnRleHRDb250ZW50O1xuXG5cdFx0dmFyIGVudiA9IHtcblx0XHRcdGVsZW1lbnQ6IGVsZW1lbnQsXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0XHRncmFtbWFyOiBncmFtbWFyLFxuXHRcdFx0Y29kZTogY29kZVxuXHRcdH07XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLXNhbml0eS1jaGVjaycsIGVudik7XG5cblx0XHRpZiAoIWVudi5jb2RlIHx8ICFlbnYuZ3JhbW1hcikge1xuXHRcdFx0aWYgKGVudi5jb2RlKSB7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcdFx0ZW52LmVsZW1lbnQudGV4dENvbnRlbnQgPSBlbnYuY29kZTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHR9XG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblxuXHRcdGlmIChhc3luYyAmJiBfc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1xuXG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBldnQuZGF0YTtcblxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVudi5lbGVtZW50KTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XG5cdFx0XHR9O1xuXG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRsYW5ndWFnZTogZW52Lmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2U6IHRydWVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpO1xuXG5cdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZWxlbWVudCk7XG5cblx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHR2YXIgdG9rZW5zID0gXy50b2tlbml6ZSh0ZXh0LCBncmFtbWFyKTtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udXRpbC5lbmNvZGUodG9rZW5zKSwgbGFuZ3VhZ2UpO1xuXHR9LFxuXG5cdG1hdGNoR3JhbW1hcjogZnVuY3Rpb24gKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaW5kZXgsIHN0YXJ0UG9zLCBvbmVzaG90LCB0YXJnZXQpIHtcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xuXG5cdFx0Zm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRva2VuID09IHRhcmdldCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBwYXR0ZXJucyA9IGdyYW1tYXJbdG9rZW5dO1xuXHRcdFx0cGF0dGVybnMgPSAoXy51dGlsLnR5cGUocGF0dGVybnMpID09PSBcIkFycmF5XCIpID8gcGF0dGVybnMgOiBbcGF0dGVybnNdO1xuXG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHBhdHRlcm5zLmxlbmd0aDsgKytqKSB7XG5cdFx0XHRcdHZhciBwYXR0ZXJuID0gcGF0dGVybnNbal0sXG5cdFx0XHRcdFx0aW5zaWRlID0gcGF0dGVybi5pbnNpZGUsXG5cdFx0XHRcdFx0bG9va2JlaGluZCA9ICEhcGF0dGVybi5sb29rYmVoaW5kLFxuXHRcdFx0XHRcdGdyZWVkeSA9ICEhcGF0dGVybi5ncmVlZHksXG5cdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IDAsXG5cdFx0XHRcdFx0YWxpYXMgPSBwYXR0ZXJuLmFsaWFzO1xuXG5cdFx0XHRcdGlmIChncmVlZHkgJiYgIXBhdHRlcm4ucGF0dGVybi5nbG9iYWwpIHtcblx0XHRcdFx0XHQvLyBXaXRob3V0IHRoZSBnbG9iYWwgZmxhZywgbGFzdEluZGV4IHdvbid0IHdvcmtcblx0XHRcdFx0XHR2YXIgZmxhZ3MgPSBwYXR0ZXJuLnBhdHRlcm4udG9TdHJpbmcoKS5tYXRjaCgvW2ltdXldKiQvKVswXTtcblx0XHRcdFx0XHRwYXR0ZXJuLnBhdHRlcm4gPSBSZWdFeHAocGF0dGVybi5wYXR0ZXJuLnNvdXJjZSwgZmxhZ3MgKyBcImdcIik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuIHx8IHBhdHRlcm47XG5cblx0XHRcdFx0Ly8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3Bcblx0XHRcdFx0Zm9yICh2YXIgaSA9IGluZGV4LCBwb3MgPSBzdGFydFBvczsgaSA8IHN0cmFyci5sZW5ndGg7IHBvcyArPSBzdHJhcnJbaV0ubGVuZ3RoLCArK2kpIHtcblxuXHRcdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XG5cblx0XHRcdFx0XHRpZiAoc3RyYXJyLmxlbmd0aCA+IHRleHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChzdHIgaW5zdGFuY2VvZiBUb2tlbikge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSAwO1xuXG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gcGF0dGVybi5leGVjKHN0ciksXG5cdFx0XHRcdFx0ICAgIGRlbE51bSA9IDE7XG5cblx0XHRcdFx0XHQvLyBHcmVlZHkgcGF0dGVybnMgY2FuIG92ZXJyaWRlL3JlbW92ZSB1cCB0byB0d28gcHJldmlvdXNseSBtYXRjaGVkIHRva2Vuc1xuXHRcdFx0XHRcdGlmICghbWF0Y2ggJiYgZ3JlZWR5ICYmIGkgIT0gc3RyYXJyLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xuXHRcdFx0XHRcdFx0bWF0Y2ggPSBwYXR0ZXJuLmV4ZWModGV4dCk7XG5cdFx0XHRcdFx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcblx0XHRcdFx0XHRcdCAgICB0byA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoLFxuXHRcdFx0XHRcdFx0ICAgIGsgPSBpLFxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIGxlbiA9IHN0cmFyci5sZW5ndGg7IGsgPCBsZW4gJiYgKHAgPCB0byB8fCAoIXN0cmFycltrXS50eXBlICYmICFzdHJhcnJbayAtIDFdLmdyZWVkeSkpOyArK2spIHtcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBpbmRleCBpIHRvIHRoZSBlbGVtZW50IGluIHN0cmFyciB0aGF0IGlzIGNsb3Nlc3QgdG8gZnJvbVxuXHRcdFx0XHRcdFx0XHRpZiAoZnJvbSA+PSBwKSB7XG5cdFx0XHRcdFx0XHRcdFx0KytpO1xuXHRcdFx0XHRcdFx0XHRcdHBvcyA9IHA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Lypcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltpXSBpcyBhIFRva2VuLCB0aGVuIHRoZSBtYXRjaCBzdGFydHMgaW5zaWRlIGFub3RoZXIgVG9rZW4sIHdoaWNoIGlzIGludmFsaWRcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltrIC0gMV0gaXMgZ3JlZWR5IHdlIGFyZSBpbiBjb25mbGljdCB3aXRoIGFub3RoZXIgZ3JlZWR5IHBhdHRlcm5cblx0XHRcdFx0XHRcdCAqL1xuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuIHx8IHN0cmFycltrIC0gMV0uZ3JlZWR5KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOdW1iZXIgb2YgdG9rZW5zIHRvIGRlbGV0ZSBhbmQgcmVwbGFjZSB3aXRoIHRoZSBuZXcgbWF0Y2hcblx0XHRcdFx0XHRcdGRlbE51bSA9IGsgLSBpO1xuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xuXHRcdFx0XHRcdFx0bWF0Y2guaW5kZXggLT0gcG9zO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdFx0XHRcdGlmIChvbmVzaG90KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0ubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggKyBsb29rYmVoaW5kTGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBtYXRjaCA9IG1hdGNoWzBdLnNsaWNlKGxvb2tiZWhpbmRMZW5ndGgpLFxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXG5cdFx0XHRcdFx0ICAgIGJlZm9yZSA9IHN0ci5zbGljZSgwLCBmcm9tKSxcblx0XHRcdFx0XHQgICAgYWZ0ZXIgPSBzdHIuc2xpY2UodG8pO1xuXG5cdFx0XHRcdFx0dmFyIGFyZ3MgPSBbaSwgZGVsTnVtXTtcblxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcblx0XHRcdFx0XHRcdCsraTtcblx0XHRcdFx0XHRcdHBvcyArPSBiZWZvcmUubGVuZ3RoO1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XG5cblx0XHRcdFx0XHRhcmdzLnB1c2god3JhcHBlZCk7XG5cblx0XHRcdFx0XHRpZiAoYWZ0ZXIpIHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChhZnRlcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0QXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShzdHJhcnIsIGFyZ3MpO1xuXG5cdFx0XHRcdFx0aWYgKGRlbE51bSAhPSAxKVxuXHRcdFx0XHRcdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCBpLCBwb3MsIHRydWUsIHRva2VuKTtcblxuXHRcdFx0XHRcdGlmIChvbmVzaG90KVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0dG9rZW5pemU6IGZ1bmN0aW9uKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcblxuXHRcdHZhciByZXN0ID0gZ3JhbW1hci5yZXN0O1xuXG5cdFx0aWYgKHJlc3QpIHtcblx0XHRcdGZvciAodmFyIHRva2VuIGluIHJlc3QpIHtcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcblx0XHR9XG5cblx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIDAsIDAsIGZhbHNlKTtcblxuXHRcdHJldHVybiBzdHJhcnI7XG5cdH0sXG5cblx0aG9va3M6IHtcblx0XHRhbGw6IHt9LFxuXG5cdFx0YWRkOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xuXG5cdFx0XHRob29rc1tuYW1lXSA9IGhvb2tzW25hbWVdIHx8IFtdO1xuXG5cdFx0XHRob29rc1tuYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0XHR9LFxuXG5cdFx0cnVuOiBmdW5jdGlvbiAobmFtZSwgZW52KSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tzID0gXy5ob29rcy5hbGxbbmFtZV07XG5cblx0XHRcdGlmICghY2FsbGJhY2tzIHx8ICFjYWxsYmFja3MubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yICh2YXIgaT0wLCBjYWxsYmFjazsgY2FsbGJhY2sgPSBjYWxsYmFja3NbaSsrXTspIHtcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50LCBhbGlhcywgbWF0Y2hlZFN0ciwgZ3JlZWR5KSB7XG5cdHRoaXMudHlwZSA9IHR5cGU7XG5cdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG5cdHRoaXMuYWxpYXMgPSBhbGlhcztcblx0Ly8gQ29weSBvZiB0aGUgZnVsbCBzdHJpbmcgdGhpcyB0b2tlbiB3YXMgY3JlYXRlZCBmcm9tXG5cdHRoaXMubGVuZ3RoID0gKG1hdGNoZWRTdHIgfHwgXCJcIikubGVuZ3RofDA7XG5cdHRoaXMuZ3JlZWR5ID0gISFncmVlZHk7XG59O1xuXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XG5cdGlmICh0eXBlb2YgbyA9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBvO1xuXHR9XG5cblx0aWYgKF8udXRpbC50eXBlKG8pID09PSAnQXJyYXknKSB7XG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoZWxlbWVudCwgbGFuZ3VhZ2UsIG8pO1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0dmFyIGVudiA9IHtcblx0XHR0eXBlOiBvLnR5cGUsXG5cdFx0Y29udGVudDogVG9rZW4uc3RyaW5naWZ5KG8uY29udGVudCwgbGFuZ3VhZ2UsIHBhcmVudCksXG5cdFx0dGFnOiAnc3BhbicsXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXG5cdFx0YXR0cmlidXRlczoge30sXG5cdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdHBhcmVudDogcGFyZW50XG5cdH07XG5cblx0aWYgKG8uYWxpYXMpIHtcblx0XHR2YXIgYWxpYXNlcyA9IF8udXRpbC50eXBlKG8uYWxpYXMpID09PSAnQXJyYXknID8gby5hbGlhcyA6IFtvLmFsaWFzXTtcblx0XHRBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShlbnYuY2xhc3NlcywgYWxpYXNlcyk7XG5cdH1cblxuXHRfLmhvb2tzLnJ1bignd3JhcCcsIGVudik7XG5cblx0dmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhlbnYuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gbmFtZSArICc9XCInICsgKGVudi5hdHRyaWJ1dGVzW25hbWVdIHx8ICcnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykgKyAnXCInO1xuXHR9KS5qb2luKCcgJyk7XG5cblx0cmV0dXJuICc8JyArIGVudi50YWcgKyAnIGNsYXNzPVwiJyArIGVudi5jbGFzc2VzLmpvaW4oJyAnKSArICdcIicgKyAoYXR0cmlidXRlcyA/ICcgJyArIGF0dHJpYnV0ZXMgOiAnJykgKyAnPicgKyBlbnYuY29udGVudCArICc8LycgKyBlbnYudGFnICsgJz4nO1xuXG59O1xuXG5pZiAoIV9zZWxmLmRvY3VtZW50KSB7XG5cdGlmICghX3NlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHRcdC8vIGluIE5vZGUuanNcblx0XHRyZXR1cm4gX3NlbGYuUHJpc207XG5cdH1cblxuXHRpZiAoIV8uZGlzYWJsZVdvcmtlck1lc3NhZ2VIYW5kbGVyKSB7XG5cdFx0Ly8gSW4gd29ya2VyXG5cdFx0X3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldnQpIHtcblx0XHRcdHZhciBtZXNzYWdlID0gSlNPTi5wYXJzZShldnQuZGF0YSksXG5cdFx0XHRcdGxhbmcgPSBtZXNzYWdlLmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlID0gbWVzc2FnZS5jb2RlLFxuXHRcdFx0XHRpbW1lZGlhdGVDbG9zZSA9IG1lc3NhZ2UuaW1tZWRpYXRlQ2xvc2U7XG5cblx0XHRcdF9zZWxmLnBvc3RNZXNzYWdlKF8uaGlnaGxpZ2h0KGNvZGUsIF8ubGFuZ3VhZ2VzW2xhbmddLCBsYW5nKSk7XG5cdFx0XHRpZiAoaW1tZWRpYXRlQ2xvc2UpIHtcblx0XHRcdFx0X3NlbGYuY2xvc2UoKTtcblx0XHRcdH1cblx0XHR9LCBmYWxzZSk7XG5cdH1cblxuXHRyZXR1cm4gX3NlbGYuUHJpc207XG59XG5cbi8vR2V0IGN1cnJlbnQgc2NyaXB0IGFuZCBoaWdobGlnaHRcbnZhciBzY3JpcHQgPSBkb2N1bWVudC5jdXJyZW50U2NyaXB0IHx8IFtdLnNsaWNlLmNhbGwoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIikpLnBvcCgpO1xuXG5pZiAoc2NyaXB0KSB7XG5cdF8uZmlsZW5hbWUgPSBzY3JpcHQuc3JjO1xuXG5cdGlmICghXy5tYW51YWwgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcblx0XHRpZihkb2N1bWVudC5yZWFkeVN0YXRlICE9PSBcImxvYWRpbmdcIikge1xuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShfLmhpZ2hsaWdodEFsbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBfLmhpZ2hsaWdodEFsbCk7XG5cdFx0fVxuXHR9XG59XG5cbnJldHVybiBfc2VsZi5QcmlzbTtcblxufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJpc207XG59XG5cbi8vIGhhY2sgZm9yIGNvbXBvbmVudHMgdG8gd29yayBjb3JyZWN0bHkgaW4gbm9kZS5qc1xuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdGdsb2JhbC5QcmlzbSA9IFByaXNtO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XG5cdCdjb21tZW50JzogLzwhLS1bXFxzXFxTXSo/LS0+Lyxcblx0J3Byb2xvZyc6IC88XFw/W1xcc1xcU10rP1xcPz4vLFxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxuXHQnY2RhdGEnOiAvPCFcXFtDREFUQVxcW1tcXHNcXFNdKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxbXFxzXFxTXXwoPyFcXDEpW15cXFxcXSkqXFwxfFteXFxzJ1wiPj1dKykpPykqXFxzKlxcLz8+L2ksXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQndGFnJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvXjxcXC8/W15cXHM+XFwvXSsvaSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogL148XFwvPy8sXG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW15cXHM+XFwvOl0rOi9cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdhdHRyLXZhbHVlJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvPSg/OihcInwnKSg/OlxcXFxbXFxzXFxTXXwoPyFcXDEpW15cXFxcXSkqXFwxfFteXFxzJ1wiPj1dKykvaSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogW1xuXHRcdFx0XHRcdFx0L149Lyxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogLyhefFteXFxcXF0pW1wiJ10vLFxuXHRcdFx0XHRcdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+Lyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXlxccz5cXC9dKy8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mIz9bXFxkYS16XXsxLDh9Oy9pXG59O1xuXG5QcmlzbS5sYW5ndWFnZXMubWFya3VwWyd0YWcnXS5pbnNpZGVbJ2F0dHItdmFsdWUnXS5pbnNpZGVbJ2VudGl0eSddID1cblx0UHJpc20ubGFuZ3VhZ2VzLm1hcmt1cFsnZW50aXR5J107XG5cbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XG5QcmlzbS5ob29rcy5hZGQoJ3dyYXAnLCBmdW5jdGlvbihlbnYpIHtcblxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3RpdGxlJ10gPSBlbnYuY29udGVudC5yZXBsYWNlKC8mYW1wOy8sICcmJyk7XG5cdH1cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMueG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5odG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5tYXRobWwgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuUHJpc20ubGFuZ3VhZ2VzLnN2ZyA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1jc3MuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNzcyA9IHtcblx0J2NvbW1lbnQnOiAvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy8sXG5cdCdhdHJ1bGUnOiB7XG5cdFx0cGF0dGVybjogL0BbXFx3LV0rPy4qPyg/Ojt8KD89XFxzKlxceykpL2ksXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQncnVsZSc6IC9AW1xcdy1dKy9cblx0XHRcdC8vIFNlZSByZXN0IGJlbG93XG5cdFx0fVxuXHR9LFxuXHQndXJsJzogL3VybFxcKCg/OihbXCInXSkoPzpcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxfC4qPylcXCkvaSxcblx0J3NlbGVjdG9yJzogL1tee31cXHNdW157fTtdKj8oPz1cXHMqXFx7KS8sXG5cdCdzdHJpbmcnOiB7XG5cdFx0cGF0dGVybjogLyhcInwnKSg/OlxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQncHJvcGVydHknOiAvWy1fYS16XFx4QTAtXFx1RkZGRl1bLVxcd1xceEEwLVxcdUZGRkZdKig/PVxccyo6KS9pLFxuXHQnaW1wb3J0YW50JzogL1xcQiFpbXBvcnRhbnRcXGIvaSxcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXG5cdCdwdW5jdHVhdGlvbic6IC9bKCl7fTs6XS9cbn07XG5cblByaXNtLmxhbmd1YWdlcy5jc3NbJ2F0cnVsZSddLmluc2lkZS5yZXN0ID0gUHJpc20udXRpbC5jbG9uZShQcmlzbS5sYW5ndWFnZXMuY3NzKTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc3R5bGUnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc3R5bGU+KS9pLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzcyxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJyxcblx0XHRcdGdyZWVkeTogdHJ1ZVxuXHRcdH1cblx0fSk7XG5cblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnaW5zaWRlJywgJ2F0dHItdmFsdWUnLCB7XG5cdFx0J3N0eWxlLWF0dHInOiB7XG5cdFx0XHRwYXR0ZXJuOiAvXFxzKnN0eWxlPShcInwnKSg/OlxcXFxbXFxzXFxTXXwoPyFcXDEpW15cXFxcXSkqXFwxL2ksXG5cdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0J2F0dHItbmFtZSc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXG5cdFx0XHRcdCdhdHRyLXZhbHVlJzoge1xuXHRcdFx0XHRcdHBhdHRlcm46IC8uKy9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXG5cdFx0fVxuXHR9LCBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZyk7XG59XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xuXHQnY29tbWVudCc6IFtcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFxzXFxTXSo/KD86XFwqXFwvfCQpLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFw6XSlcXC9cXC8uKi8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fVxuXHRdLFxuXHQnc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC8oW1wiJ10pKD86XFxcXCg/OlxcclxcbnxbXFxzXFxTXSl8KD8hXFwxKVteXFxcXFxcclxcbl0pKlxcMS8sXG5cdFx0Z3JlZWR5OiB0cnVlXG5cdH0sXG5cdCdjbGFzcy1uYW1lJzoge1xuXHRcdHBhdHRlcm46IC8oKD86XFxiKD86Y2xhc3N8aW50ZXJmYWNlfGV4dGVuZHN8aW1wbGVtZW50c3x0cmFpdHxpbnN0YW5jZW9mfG5ldylcXHMrKXwoPzpjYXRjaFxccytcXCgpKVtcXHcuXFxcXF0rL2ksXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdHB1bmN0dWF0aW9uOiAvWy5cXFxcXS9cblx0XHR9XG5cdH0sXG5cdCdrZXl3b3JkJzogL1xcYig/OmlmfGVsc2V8d2hpbGV8ZG98Zm9yfHJldHVybnxpbnxpbnN0YW5jZW9mfGZ1bmN0aW9ufG5ld3x0cnl8dGhyb3d8Y2F0Y2h8ZmluYWxseXxudWxsfGJyZWFrfGNvbnRpbnVlKVxcYi8sXG5cdCdib29sZWFuJzogL1xcYig/OnRydWV8ZmFsc2UpXFxiLyxcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXG5cdCdudW1iZXInOiAvXFxiLT8oPzoweFtcXGRhLWZdK3xcXGQqXFwuP1xcZCsoPzplWystXT9cXGQrKT8pXFxiL2ksXG5cdCdvcGVyYXRvcic6IC8tLT98XFwrXFwrP3whPT89P3w8PT98Pj0/fD09Pz0/fCYmP3xcXHxcXHw/fFxcP3xcXCp8XFwvfH58XFxefCUvLFxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXG59O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tamF2YXNjcmlwdC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCA9IFByaXNtLmxhbmd1YWdlcy5leHRlbmQoJ2NsaWtlJywge1xuXHQna2V5d29yZCc6IC9cXGIoPzphc3xhc3luY3xhd2FpdHxicmVha3xjYXNlfGNhdGNofGNsYXNzfGNvbnN0fGNvbnRpbnVlfGRlYnVnZ2VyfGRlZmF1bHR8ZGVsZXRlfGRvfGVsc2V8ZW51bXxleHBvcnR8ZXh0ZW5kc3xmaW5hbGx5fGZvcnxmcm9tfGZ1bmN0aW9ufGdldHxpZnxpbXBsZW1lbnRzfGltcG9ydHxpbnxpbnN0YW5jZW9mfGludGVyZmFjZXxsZXR8bmV3fG51bGx8b2Z8cGFja2FnZXxwcml2YXRlfHByb3RlY3RlZHxwdWJsaWN8cmV0dXJufHNldHxzdGF0aWN8c3VwZXJ8c3dpdGNofHRoaXN8dGhyb3d8dHJ5fHR5cGVvZnx2YXJ8dm9pZHx3aGlsZXx3aXRofHlpZWxkKVxcYi8sXG5cdCdudW1iZXInOiAvXFxiLT8oPzowW3hYXVtcXGRBLUZhLWZdK3wwW2JCXVswMV0rfDBbb09dWzAtN10rfFxcZCpcXC4/XFxkKyg/OltFZV1bKy1dP1xcZCspP3xOYU58SW5maW5pdHkpXFxiLyxcblx0Ly8gQWxsb3cgZm9yIGFsbCBub24tQVNDSUkgY2hhcmFjdGVycyAoU2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIwMDg0NDQpXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpcXHhBMC1cXHVGRkZGXVskXFx3XFx4QTAtXFx1RkZGRl0qKD89XFxzKlxcKCkvaSxcblx0J29wZXJhdG9yJzogLy1bLT1dP3xcXCtbKz1dP3whPT89P3w8PD89P3w+Pj8+Pz0/fD0oPzo9PT98Pik/fCZbJj1dP3xcXHxbfD1dP3xcXCpcXCo/PT98XFwvPT98fnxcXF49P3wlPT98XFw/fFxcLnszfS9cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ2tleXdvcmQnLCB7XG5cdCdyZWdleCc6IHtcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcW1teXFxdXFxyXFxuXStdfFxcXFwufFteL1xcXFxcXFtcXHJcXG5dKStcXC9bZ2lteXVdezAsNX0oPz1cXHMqKCR8W1xcclxcbiwuO30pXSkpLyxcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQvLyBUaGlzIG11c3QgYmUgZGVjbGFyZWQgYmVmb3JlIGtleXdvcmQgYmVjYXVzZSB3ZSB1c2UgXCJmdW5jdGlvblwiIGluc2lkZSB0aGUgbG9vay1mb3J3YXJkXG5cdCdmdW5jdGlvbi12YXJpYWJsZSc6IHtcblx0XHRwYXR0ZXJuOiAvW18kYS16XFx4QTAtXFx1RkZGRl1bJFxcd1xceEEwLVxcdUZGRkZdKig/PVxccyo9XFxzKig/OmZ1bmN0aW9uXFxifCg/OlxcKFteKCldKlxcKXxbXyRhLXpcXHhBMC1cXHVGRkZGXVskXFx3XFx4QTAtXFx1RkZGRl0qKVxccyo9PikpL2ksXG5cdFx0YWxpYXM6ICdmdW5jdGlvbidcblx0fVxufSk7XG5cblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAnc3RyaW5nJywge1xuXHQndGVtcGxhdGUtc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC9gKD86XFxcXFtcXHNcXFNdfFteXFxcXGBdKSpgLyxcblx0XHRncmVlZHk6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQnaW50ZXJwb2xhdGlvbic6IHtcblx0XHRcdFx0cGF0dGVybjogL1xcJFxce1tefV0rXFx9Lyxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J2ludGVycG9sYXRpb24tcHVuY3R1YXRpb24nOiB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxcJFxce3xcXH0kLyxcblx0XHRcdFx0XHRcdGFsaWFzOiAncHVuY3R1YXRpb24nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRyZXN0OiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3N0cmluZyc6IC9bXFxzXFxTXSsvXG5cdFx0fVxuXHR9XG59KTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc2NyaXB0Jzoge1xuXHRcdFx0cGF0dGVybjogLyg8c2NyaXB0W1xcc1xcU10qPz4pW1xcc1xcU10qPyg/PTxcXC9zY3JpcHQ+KS9pLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQsXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWphdmFzY3JpcHQnLFxuXHRcdFx0Z3JlZWR5OiB0cnVlXG5cdFx0fVxuXHR9KTtcbn1cblxuUHJpc20ubGFuZ3VhZ2VzLmpzID0gUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQ7XG5cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1maWxlLWhpZ2hsaWdodC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuXHRpZiAodHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnIHx8ICFzZWxmLlByaXNtIHx8ICFzZWxmLmRvY3VtZW50IHx8ICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0c2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0ID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgRXh0ZW5zaW9ucyA9IHtcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0Jyxcblx0XHRcdCdweSc6ICdweXRob24nLFxuXHRcdFx0J3JiJzogJ3J1YnknLFxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcblx0XHRcdCdwc20xJzogJ3Bvd2Vyc2hlbGwnLFxuXHRcdFx0J3NoJzogJ2Jhc2gnLFxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXG5cdFx0XHQnaCc6ICdjJyxcblx0XHRcdCd0ZXgnOiAnbGF0ZXgnXG5cdFx0fTtcblxuXHRcdEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ByZVtkYXRhLXNyY10nKSkuZm9yRWFjaChmdW5jdGlvbiAocHJlKSB7XG5cdFx0XHR2YXIgc3JjID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcblxuXHRcdFx0dmFyIGxhbmd1YWdlLCBwYXJlbnQgPSBwcmU7XG5cdFx0XHR2YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LSg/IVxcKikoXFx3KylcXGIvaTtcblx0XHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0XHRwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRsYW5ndWFnZSA9IChwcmUuY2xhc3NOYW1lLm1hdGNoKGxhbmcpIHx8IFssICcnXSlbMV07XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbGFuZ3VhZ2UpIHtcblx0XHRcdFx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCAnJ10pWzFdO1xuXHRcdFx0XHRsYW5ndWFnZSA9IEV4dGVuc2lvbnNbZXh0ZW5zaW9uXSB8fCBleHRlbnNpb247XG5cdFx0XHR9XG5cblx0XHRcdHZhciBjb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY29kZScpO1xuXHRcdFx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXG5cdFx0XHRwcmUudGV4dENvbnRlbnQgPSAnJztcblxuXHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICdMb2FkaW5n4oCmJztcblxuXHRcdFx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xuXG5cdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cblx0XHRcdHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpO1xuXG5cdFx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgPT0gNCkge1xuXG5cdFx0XHRcdFx0aWYgKHhoci5zdGF0dXMgPCA0MDAgJiYgeGhyLnJlc3BvbnNlVGV4dCkge1xuXHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9IHhoci5yZXNwb25zZVRleHQ7XG5cblx0XHRcdFx0XHRcdFByaXNtLmhpZ2hsaWdodEVsZW1lbnQoY29kZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKHhoci5zdGF0dXMgPj0gNDAwKSB7XG5cdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvciAnICsgeGhyLnN0YXR1cyArICcgd2hpbGUgZmV0Y2hpbmcgZmlsZTogJyArIHhoci5zdGF0dXNUZXh0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yOiBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIGlzIGVtcHR5Jztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHhoci5zZW5kKG51bGwpO1xuXHRcdH0pO1xuXG5cdH07XG5cblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHNlbGYuUHJpc20uZmlsZUhpZ2hsaWdodCk7XG5cbn0pKCk7XG4iXX0=
