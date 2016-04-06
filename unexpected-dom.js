(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var matchesSelector = require('./matchesSelector');

function parseHtml(str, isFragment, assertionNameForErrorMessage) {
  if (isFragment) {
    str = '<html><head></head><body>' + str + '</body></html>';
  }
  var htmlDocument;
  if (typeof DOMParser !== 'undefined') {
    htmlDocument = new DOMParser().parseFromString(str, 'text/html');
  } else if (typeof document !== 'undefined' && document.implementation && document.implementation.createHTMLDocument) {
    htmlDocument = document.implementation.createHTMLDocument('');
    htmlDocument.open();
    htmlDocument.write(str);
    htmlDocument.close();
  } else {
    var jsdom;
    try {
      jsdom = require('' + 'jsdom');
    } catch (err) {
      throw new Error('unexpected-dom' + (assertionNameForErrorMessage ? ' (' + assertionNameForErrorMessage + ')' : '') + ': Running outside a browser, but could not find the `jsdom` module. Please npm install jsdom to make this work.');
    }
    htmlDocument = jsdom.jsdom(str);
  }
  if (isFragment) {
    var body = htmlDocument.body;
    var documentFragment = htmlDocument.createDocumentFragment();
    if (body) {
      for (var i = 0 ; i < body.childNodes.length ; i += 1) {
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
      throw new Error('unexpected-dom' + (assertionNameForErrorMessage ? ' (' + assertionNameForErrorMessage + ')' : '') + ': Running outside a browser (or in a browser without DOMParser), but could not find the `jsdom` module. Please npm install jsdom to make this work.');
    }
    return jsdom.jsdom(str, { parsingMode: 'xml' });
  }
}

// From html-minifier
var enumeratedAttributeValues = {
  draggable: ['true', 'false'] // defaults to 'auto'
};

function isBooleanAttribute(attrName, attrValue) {
  var isSimpleBoolean = (/^(?:allowfullscreen|async|autofocus|autoplay|checked|compact|controls|declare|default|defaultchecked|defaultmuted|defaultselected|defer|disabled|enabled|formnovalidate|hidden|indeterminate|inert|ismap|itemscope|loop|multiple|muted|nohref|noresize|noshade|novalidate|nowrap|open|pauseonexit|readonly|required|reversed|scoped|seamless|selected|sortable|spellcheck|truespeed|typemustmatch|visible)$/i).test(attrName);
  if (isSimpleBoolean) {
    return true;
  }

  var attrValueEnumeration = enumeratedAttributeValues[attrName.toLowerCase()];
  if (!attrValueEnumeration) {
    return false;
  }
  else {
    return (-1 === attrValueEnumeration.indexOf(attrValue.toLowerCase()));
  }
}

function styleStringToObject(str) {
  var styles = {};

  str.split(';').forEach(function (rule) {
    var tuple = rule.split(':').map(function (part) { return part.trim(); });

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
      result[attrs[i].name] = attrs[i].value && attrs[i].value.split(' ') || [];
    } else if (attrs[i].name === 'style') {
      result[attrs[i].name] = styleStringToObject(attrs[i].value);
    } else {
      result[attrs[i].name] = isHtml && isBooleanAttribute(attrs[i].name) ? true : (attrs[i].value || '');
    }
  }

  return result;
}

function getCanonicalAttributes(element) {
  var attrs = getAttributes(element);
  var result = {};

  Object.keys(attrs).sort().forEach(function (key) {
    result[key] = attrs[key];
  });

  return result;
}

function entitify(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function isVoidElement(elementName) {
  return (/(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)/i).test(elementName);
}

function writeAttributeToMagicPen(output, attributeName, value, isHtml) {
  output.prismAttrName(attributeName);
  if (!isHtml || !isBooleanAttribute(attributeName)) {
    if (attributeName === 'class') {
      value = value.join(' ');
    } else if (attributeName === 'style') {
      value = Object.keys(value).map(function (cssProp) {
        return cssProp + ': ' + value[cssProp];
      }).join('; ');
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
    return 'style="' + Object.keys(value).map(function (cssProp) {
      return [cssProp, value[cssProp]].join(': '); // FIXME: entitify
    }).join('; ') + '"';
  } else {
    return attributeName + '="' + entitify(value) + '"';
  }
}

function stringifyStartTag(element) {
  var elementName = element.ownerDocument.contentType === 'text/html' ? element.nodeName.toLowerCase() : element.nodeName;
  var str = '<' + elementName;
  var attrs = getCanonicalAttributes(element);

  Object.keys(attrs).forEach(function (key) {
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
  installInto: function (expect) {
    expect.installPlugin(require('magicpen-prism'));
    var topLevelExpect = expect;
    expect.addType({
      name: 'DOMNode',
      base: 'object',
      identify: function (obj) {
        return obj && obj.nodeName && [2, 3, 4, 5, 6, 7, 10, 11, 12].indexOf(obj.nodeType) > -1;
      },
      equal: function (a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function (element, depth, output) {
        return output.code(element.nodeName + ' "' + element.nodeValue + '"', 'prism-string');
      }
    });

    expect.addType({
      name: 'DOMComment',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 8;
      },
      equal: function (a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function (element, depth, output) {
        return output.code('<!--' + element.nodeValue + '-->', 'html');
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        var d = diff('<!--' + actual.nodeValue + '-->', '<!--' + expected.nodeValue + '-->');
        d.inline = true;
        return d;
      }
    });

    expect.addType({
      name: 'DOMTextNode',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 3;
      },
      equal: function (a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function (element, depth, output) {
        return output.code(entitify(element.nodeValue.trim()), 'html');
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        var d = diff(actual.nodeValue, expected.nodeValue);
        d.inline = true;
        return d;
      }
    });

    expect.addType({
      name: 'DOMNodeList',
      base: 'array-like',
      prefix: function (output) {
        return output.text('NodeList[');
      },
      suffix: function (output) {
        return output.text(']');
      },
      similar: function (a, b) {
        // Figure out whether a and b are "struturally similar" so they can be diffed inline.
        return (
          a.nodeType === 1 && b.nodeType === 1 &&
          a.nodeName === b.nodeName
        );
      },
      identify: function (obj) {
        return (
          obj &&
          typeof obj.length === 'number' &&
          typeof obj.toString === 'function' &&
          typeof obj.item === 'function' &&
          // With jsdom 6+, nodeList.toString() comes out as '[object Object]', so fall back to the constructor name:
          (obj.toString().indexOf('NodeList') !== -1 || (obj.constructor && obj.constructor.name === 'NodeList'))
        );
      }
    });

    // Fake type to make it possible to build 'to satisfy' diffs to be rendered inline:
    expect.addType({
      name: 'attachedDOMNodeList',
      base: 'DOMNodeList',
      indent: false,
      prefix: function (output) { return output; },
      suffix: function (output) { return output; },
      delimiter: function (output) { return output; },
      identify: function (obj) {
        return obj && obj._isAttachedDOMNodeList;
      }
    });

    function makeAttachedDOMNodeList(domNodeList, contentType) {
      var attachedDOMNodeList = [];
      for (var i = 0 ; i < domNodeList.length ; i += 1) {
        attachedDOMNodeList.push(domNodeList[i]);
      }
      attachedDOMNodeList._isAttachedDOMNodeList = true;
      attachedDOMNodeList.ownerDocument = { contentType: contentType };
      return attachedDOMNodeList;
    }

    expect.addType({
      name: 'HTMLDocType',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 10 && 'publicId' in obj;
      },
      inspect: function (doctype, depth, output, inspect) {
        output.code('<!DOCTYPE ' + doctype.name + '>', 'html');
      },
      equal: function (a, b) {
        return a.toString() === b.toString();
      },
      diff: function (actual, expected, output, diff) {
        var d = diff('<!DOCTYPE ' + actual.name + '>', '<!DOCTYPE ' + expected.name + '>');
        d.inline = true;
        return d;
      }
    });

    expect.addType({
      name: 'DOMDocument',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 9 && obj.documentElement && obj.implementation;
      },
      inspect: function (document, depth, output, inspect) {
        for (var i = 0 ; i < document.childNodes.length ; i += 1) {
          output.append(inspect(document.childNodes[i]));
        }
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        var result = {
          inline: true,
          diff: output
        };
        result.diff.append(diff(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)).diff);
        return result;
      }
    });

    expect.addType({
      name: 'HTMLDocument',
      base: 'DOMDocument',
      identify: function (obj) {
        return this.baseType.identify(obj) && obj.contentType === 'text/html';
      }
    });

    expect.addType({
      name: 'XMLDocument',
      base: 'DOMDocument',
      identify: function (obj) {
        return this.baseType.identify(obj) && /^(?:application|text)\/xml|\+xml\b/.test(obj.contentType);
      },
      inspect: function (document, depth, output, inspect) {
        output.code('<?xml version="1.0"?>', 'xml');
        for (var i = 0 ; i < document.childNodes.length ; i += 1) {
          output.append(inspect(document.childNodes[i], depth - 1));
        }
      }
    });

    expect.addType({
      name: 'DOMDocumentFragment',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && obj.nodeType === 11; // In jsdom, documentFragment.toString() does not return [object DocumentFragment]
      },
      inspect: function (documentFragment, depth, output, inspect) {
        output.text('DocumentFragment[').append(inspect(documentFragment.childNodes, depth)).text(']');
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        var result = {
          inline: true,
          diff: output
        };
        result.diff.block(diff(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)).diff);
        return result;
      }
    });

    expect.addType({
      name: 'DOMElement',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 1 && obj.nodeName && obj.attributes;
      },
      equal: function (a, b, equal) {
        var aIsHtml = isInsideHtmlDocument(a);
        var bIsHtml = isInsideHtmlDocument(b);
        return (
          aIsHtml === bIsHtml &&
          (aIsHtml ? a.nodeName.toLowerCase() === b.nodeName.toLowerCase() : a.nodeName === b.nodeName) &&
          equal(getAttributes(a), getAttributes(b)) && equal(a.childNodes, b.childNodes)
        );
      },
      inspect: function (element, depth, output, inspect) {
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
              inspectedChildren.push(output.clone().code(element.textContent, type));
            } else if (elementName === 'style') {
              inspectedChildren.push(output.clone().code(element.textContent, element.getAttribute('type') || 'text/css'));
            } else {
              for (var i = 0 ; i < element.childNodes.length ; i += 1) {
                inspectedChildren.push(inspect(element.childNodes[i]));
              }
            }

            var width = 0;
            var multipleLines = inspectedChildren.some(function (o) {
              var size = o.size();
              width += size.width;
              return width > 50 || o.height > 1;
            });

            if (multipleLines) {
              output.nl().indentLines();

              inspectedChildren.forEach(function (inspectedChild, index) {
                output.i().block(inspectedChild).nl();
              });

              output.outdentLines();
            } else {
              inspectedChildren.forEach(function (inspectedChild, index) {
                output.append(inspectedChild);
              });
            }
          }
        }
        output.code(stringifyEndTag(element), 'html');
        return output;
      },
      diffLimit: 512,
      diff: function (actual, expected, output, diff, inspect, equal) {
        var isHtml = isInsideHtmlDocument(actual);
        var result = {
          diff: output,
          inline: true
        };

        if (Math.max(actual.length, expected.length) > this.diffLimit) {
          result.diff.jsComment('Diff suppressed due to size > ' + this.diffLimit);
          return result;
        }

        var emptyElements = actual.childNodes.length === 0 && expected.childNodes.length === 0;
        var conflictingElement = actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase() || !equal(getAttributes(actual), getAttributes(expected));

        if (conflictingElement) {
          var canContinueLine = true;
          output
            .prismPunctuation('<')
            .prismTag(actual.nodeName.toLowerCase());
          if (actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase()) {
            output.sp().annotationBlock(function () {
              this.error('should be').sp().prismTag(expected.nodeName.toLowerCase());
            }).nl();
            canContinueLine = false;
          }
          var actualAttributes = getAttributes(actual);
          var expectedAttributes = getAttributes(expected);
          Object.keys(actualAttributes).forEach(function (attributeName) {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            writeAttributeToMagicPen(output, attributeName, actualAttributes[attributeName], isHtml);
            if (attributeName in expectedAttributes) {
              if (actualAttributes[attributeName] === expectedAttributes[attributeName]) {
                canContinueLine = true;
              } else {
                output.sp().annotationBlock(function () {
                  this.error('should equal').sp().append(inspect(entitify(expectedAttributes[attributeName])));
                }).nl();
                canContinueLine = false;
              }
              delete expectedAttributes[attributeName];
            } else {
              output.sp().annotationBlock(function () {
                this.error('should be removed');
              }).nl();
              canContinueLine = false;
            }
          });
          Object.keys(expectedAttributes).forEach(function (attributeName) {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            output.annotationBlock(function () {
              this.error('missing').sp();
              writeAttributeToMagicPen(this, attributeName, expectedAttributes[attributeName], isHtml);
            }).nl();
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
            .block(diff(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)).diff)
            .nl()
            .outdentLines();
        }

        output.code(stringifyEndTag(actual), 'html');
        return result;
      }
    });

    expect.addAssertion('<DOMElement> to have (class|classes) <array|string>', function (expect, subject, value) {
      return expect(subject, 'to have attributes', { class: value });
    });

    expect.addAssertion('<DOMElement> to only have (class|classes) <array|string>', function (expect, subject, value) {
      return expect(subject, 'to have attributes', {
        class: function (className) {
          var actualClasses = getClassNamesFromAttributeValue(className);
          if (typeof value === 'string') {
            value = getClassNamesFromAttributeValue(value);
          }
          return topLevelExpect(actualClasses.sort(), 'to equal', value.sort());
        }
      });
    });

    expect.addAssertion('<DOMTextNode> to [exhaustively] satisfy <DOMTextNode>', function (expect, subject, value) {
      return expect(subject.nodeValue, 'to equal', value.nodeValue);
    });

    expect.addAssertion('<DOMTextNode> to [exhaustively] satisfy <object>', function (expect, subject, value) {
      expect.fail();
    });

    expect.addAssertion('<DOMTextNode> to [exhaustively] satisfy <any>', function (expect, subject, value) {
      return expect(subject.nodeValue, 'to satisfy', value);
    });

    function convertDOMNodeToSatisfySpec(node, isHtml) {
      if (node.nodeType === 1 || node.nodeType === 10) {
        // DOMElement or HTMLDocType
        var result = {
          name: isHtml ? node.nodeName.toLowerCase() : node.nodeName
        };
        if (node.attributes) {
          result.attributes = {};
          for (var i = 0; i < node.attributes.length ; i += 1) {
            result.attributes[node.attributes[i].name] = isHtml && isBooleanAttribute(node.attributes[i].name) ? true : (node.attributes[i].value || '');
          }
        }
        result.children = Array.prototype.map.call(node.childNodes, function (childNode) {
          return convertDOMNodeToSatisfySpec(childNode, isHtml);
        });
        return result;
      } else if (node.nodeType === 3) {
        // DOMTextNode
        return node.nodeValue;
      } else {
        throw new Error('to satisfy: Node type ' + node.nodeType + ' is not yet supported in the value');
      }
    }

    expect.addAssertion('<DOMNodeList> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
      expect.argsOutput = function (output) {
        output.code(value, isHtml ? 'html' : 'xml');
      };
      return expect(subject, 'to [exhaustively] satisfy', (isHtml ? parseHtml(value, true, expect.testDescription) : parseXml(value, expect.testDescription)).childNodes);
    });

    expect.addAssertion('<DOMNodeList> to [exhaustively] satisfy <DOMNodeList>', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
      var satisfySpecs = [];
      for (var i = 0 ; i < value.length ; i += 1) {
        satisfySpecs.push(convertDOMNodeToSatisfySpec(value[i], isHtml));
      }
      return expect(subject, 'to [exhaustively] satisfy', satisfySpecs);
    });

    expect.addAssertion('<DOMDocumentFragment> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      expect.argsOutput = function (output) {
        output.code(value, isHtml ? 'html' : 'xml');
      };
      return expect(subject, 'to [exhaustively] satisfy', isHtml ? parseHtml(value, true, expect.testDescription) : parseXml(value, expect.testDescription));
    });

    expect.addAssertion('<DOMDocumentFragment> to [exhaustively] satisfy <DOMDocumentFragment>', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
      return expect(subject, 'to [exhaustively] satisfy', Array.prototype.map.call(value.childNodes, function (childNode) {
        return convertDOMNodeToSatisfySpec(childNode, isHtml);
      }));
    });

    expect.addAssertion('<DOMDocumentFragment> to [exhaustively] satisfy <object|array>', function (expect, subject, value) {
      return expect(subject.childNodes, 'to [exhaustively] satisfy', value);
    });

    expect.addAssertion('<DOMElement> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      var documentFragment = isHtml ? parseHtml(value, true, this.testDescription) : parseXml(value, this.testDescription);
      if (documentFragment.childNodes.length !== 1) {
        throw new Error('HTMLElement to satisfy string: Only a single node is supported');
      }
      expect.argsOutput = function (output) {
        output.code(value, isHtml ? 'html' : 'xml');
      };
      return expect(subject, 'to [exhaustively] satisfy', documentFragment.childNodes[0]);
    });

    expect.addAssertion('<DOMDocument> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      var valueDocument = isHtml ? parseHtml(value, false, this.testDescription) : parseXml(value, this.testDescription);
      return expect(makeAttachedDOMNodeList(subject.childNodes), 'to [exhaustively] satisfy', Array.prototype.map.call(valueDocument.childNodes, function (childNode) {
        return convertDOMNodeToSatisfySpec(childNode, isHtml);
      }));
    });

    expect.addAssertion('<DOMDocument> to [exhaustively] satisfy <DOMDocument>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      return expect(makeAttachedDOMNodeList(subject.childNodes), 'to [exhaustively] satisfy', Array.prototype.map.call(value.childNodes, function (childNode) {
        return convertDOMNodeToSatisfySpec(childNode, isHtml);
      }));
    });

    expect.addAssertion('<DOMElement> to [exhaustively] satisfy <DOMElement>', function (expect, subject, value) {
      return expect(subject, 'to [exhaustively] satisfy', convertDOMNodeToSatisfySpec(value, isInsideHtmlDocument(subject)));
    });

    expect.addAssertion('<DOMElement> to [exhaustively] satisfy <DOMTextNode>', function (expect, subject, value) {
      expect.fail();
    });

    expect.addAssertion('<DOMTextNode> to [exhaustively] satisfy <DOMElement>', function (expect, subject, value) {
      expect.fail();
    });

    expect.addAssertion('<DOMElement> to [exhaustively] satisfy <object>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      var unsupportedOptions = Object.keys(value).filter(function (key) {
        return key !== 'attributes' && key !== 'name' && key !== 'children' && key !== 'onlyAttributes' && key !== 'textContent';
      });
      if (unsupportedOptions.length > 0) {
        throw new Error('Unsupported option' + (unsupportedOptions.length === 1 ? '' : 's') + ': ' + unsupportedOptions.join(', '));
      }

      var promiseByKey = {
        name: expect.promise(function () {
          if (value && typeof value.name !== 'undefined') {
            return topLevelExpect(isHtml ? subject.nodeName.toLowerCase() : subject.nodeName, 'to satisfy', value.name);
          }
        }),
        children: expect.promise(function () {
          if (typeof value.children !== 'undefined') {
            if (typeof value.textContent !== 'undefined') {
              throw new Error('The children and textContent properties are not supported together');
            }
            return topLevelExpect(makeAttachedDOMNodeList(subject.childNodes, subject.ownerDocument.contentType), 'to satisfy', value.children);
          } else if (typeof value.textContent !== 'undefined') {
            return topLevelExpect(subject.textContent, 'to satisfy', value.textContent);
          }
        }),
        attributes: {}
      };

      var onlyAttributes = value && value.onlyAttributes || expect.flags.exhaustively;
      var attrs = getAttributes(subject);
      var expectedAttributes = value && value.attributes;
      var expectedAttributeNames = [];

      if (typeof expectedAttributes !== 'undefined') {
        if (typeof expectedAttributes === 'string') {
          expectedAttributes = [expectedAttributes];
        }
        var expectedValueByAttributeName = {};
        if (Array.isArray(expectedAttributes)) {
          expectedAttributes.forEach(function (attributeName) {
            expectedValueByAttributeName[attributeName] = true;
          });
        } else if (expectedAttributes && typeof expectedAttributes === 'object') {
          expectedValueByAttributeName = expectedAttributes;
        }
        Object.keys(expectedValueByAttributeName).forEach(function (attributeName) {
          expectedAttributeNames.push(attributeName);
        });

        expectedAttributeNames.forEach(function (attributeName) {
          var attributeValue = subject.getAttribute(attributeName);
          var expectedAttributeValue = expectedValueByAttributeName[attributeName];
          promiseByKey.attributes[attributeName] = expect.promise(function () {
            if (attributeName === 'class' && (typeof expectedAttributeValue === 'string' || Array.isArray(expectedAttributeValue))) {
              var actualClasses = getClassNamesFromAttributeValue(attributeValue);
              var expectedClasses = expectedAttributeValue;
              if (typeof expectedClasses === 'string') {
                expectedClasses = getClassNamesFromAttributeValue(expectedAttributeValue);
              }
              if (onlyAttributes) {
                return topLevelExpect(actualClasses.sort(), 'to equal', expectedClasses.sort());
              } else {
                return topLevelExpect.apply(topLevelExpect, [actualClasses, 'to contain'].concat(expectedClasses));
              }
            } else if (attributeName === 'style') {
              var expectedStyleObj;
              if (typeof expectedValueByAttributeName.style === 'string') {
                expectedStyleObj = styleStringToObject(expectedValueByAttributeName.style);
              } else {
                expectedStyleObj = expectedValueByAttributeName.style;
              }

              if (onlyAttributes) {
                return topLevelExpect(attrs.style, 'to exhaustively satisfy', expectedStyleObj);
              } else {
                return topLevelExpect(attrs.style, 'to satisfy', expectedStyleObj);
              }
            } else if (expectedAttributeValue === true) {
              topLevelExpect(subject.hasAttribute(attributeName), 'to be true');
            } else if (typeof expectedAttributeValue === 'undefined') {
              topLevelExpect(subject.hasAttribute(attributeName), 'to be false');
            } else {
              return topLevelExpect(attributeValue, 'to satisfy', expectedAttributeValue);
            }
          });
        });

        promiseByKey.attributePresence = expect.promise(function () {
          var attributeNamesExpectedToBeDefined = [];
          expectedAttributeNames.forEach(function (attributeName) {
            if (typeof expectedValueByAttributeName[attributeName] === 'undefined') {
              expect(attrs, 'not to have key', attributeName);
            } else {
              attributeNamesExpectedToBeDefined.push(attributeName);
              expect(attrs, 'to have key', attributeName);
            }
          });
          if (onlyAttributes) {
            expect(Object.keys(attrs).sort(), 'to equal', attributeNamesExpectedToBeDefined.sort());
          }
        });
      }

      return expect.promise.all(promiseByKey).caught(function () {
        return expect.promise.settle(promiseByKey).then(function () {
          expect.fail({
            diff: function (output, diff, inspect, equal) {
              output.block(function () {
                var output = this;
                output
                  .prismPunctuation('<')
                  .prismTag(isHtml ? subject.nodeName.toLowerCase() : subject.nodeName);
                var canContinueLine = true;
                if (promiseByKey.name.isRejected()) {
                  var nameError = promiseByKey.name.reason();
                  output.sp().annotationBlock(function () {
                    this
                      .error((nameError && nameError.getLabel()) || 'should satisfy')
                      .sp()
                      .append(inspect(value.name));
                  }).nl();
                  canContinueLine = false;
                }
                Object.keys(attrs).forEach(function (attributeName) {
                  var promise = promiseByKey.attributes[attributeName];
                  output.sp(canContinueLine ? 1 : 2 + subject.nodeName.length);
                  writeAttributeToMagicPen(output, attributeName, attrs[attributeName], isHtml);
                  if ((promise && promise.isFulfilled()) || (!promise && (!onlyAttributes || expectedAttributeNames.indexOf(attributeName) !== -1))) {
                    canContinueLine = true;
                  } else {
                    output
                      .sp()
                      .annotationBlock(function () {
                        if (promise && typeof expectedValueByAttributeName[attributeName] !== 'undefined') {
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
                expectedAttributeNames.forEach(function (attributeName) {
                  if (!subject.hasAttribute(attributeName)) {
                    var promise = promiseByKey.attributes[attributeName];
                    if (!promise || promise.isRejected()) {
                      var err = promise && promise.reason();
                      output
                        .nl()
                        .sp(2 + subject.nodeName.length)
                        .annotationBlock(function () {
                          this
                            .error('missing')
                            .sp()
                            .prismAttrName(attributeName, 'html');
                          if (expectedValueByAttributeName[attributeName] !== true) {
                            this
                                .sp()
                                .error((err && err.getLabel()) || 'should satisfy')
                                .sp()
                                .append(inspect(expectedValueByAttributeName[attributeName]));
                          }
                        })
                        .nl();
                    }
                    canContinueLine = false;
                  }
                });
                output.prismPunctuation('>');
                var childrenError = promiseByKey.children.isRejected() && promiseByKey.children.reason();
                if (childrenError) {
                  var childrenDiff = childrenError.getDiff(output);
                  if (childrenDiff && childrenDiff.inline) {
                    this.nl().indentLines().i().block(childrenDiff.diff).nl().outdentLines();
                  } else {
                    output
                      .nl()
                      .indentLines()
                      .i().block(function () {
                        for (var i = 0 ; i < subject.childNodes.length ; i += 1) {
                          this.append(inspect(subject.childNodes[i])).nl();
                        }
                      });
                    output.sp().annotationBlock(function () {
                      this.append(childrenError.getErrorMessage(this));
                    });
                    output.nl();
                  }
                } else {
                  for (var i = 0 ; i < subject.childNodes.length ; i += 1) {
                    this.append(inspect(subject.childNodes[i]));
                  }
                }
                output.code(stringifyEndTag(subject), 'html');
              });
              return {
                inline: true,
                diff: output
              };
            }
          });
        });
      });
    });

    expect.addAssertion('<DOMElement> to [only] have (attribute|attributes) <string+>', function (expect, subject, value) {
      return expect(subject, 'to [only] have attributes', Array.prototype.slice.call(arguments, 2));
    });

    expect.addAssertion('<DOMElement> to [only] have (attribute|attributes) <array|object>', function (expect, subject, value) {
      return expect(subject, 'to satisfy', { attributes: value, onlyAttributes: expect.flags.only });
    });

    expect.addAssertion('<DOMElement> to have no (child|children)', function (expect, subject) {
      expect.errorMode = 'nested';
      return expect(Array.prototype.slice.call(subject.childNodes), 'to be an empty array');
    });

    expect.addAssertion('<DOMElement> to have (child|children)', function (expect, subject) {
      return expect(subject.childNodes, 'not to be empty');
    });

    expect.addAssertion('<DOMElement> to have (child|children) <string>', function (expect, subject, query) {
      expect.errorMode = 'nested';
      expect(subject.querySelectorAll(query), 'not to be empty');
    });

    expect.addAssertion('<DOMElement> to have text <any>', function (expect, subject, value) {
      return expect(subject.textContent, 'to satisfy', value);
    });

    expect.addAssertion('<DOMDocument|DOMElement|DOMDocumentFragment> [when] queried for [first] <string> <assertion?>', function (expect, subject, query) {
      var queryResult;

      expect.argsOutput[0] = function (output) {
        return output.green(query);
      };

      expect.errorMode = 'nested';

      if (expect.flags.first) {
        queryResult = subject.querySelector(query);
        if (!queryResult) {
          expect.fail(function (output) {
            output.error('The selector').sp().jsString(query).sp().error('yielded no results');
          });
        }
      } else {
        queryResult = subject.querySelectorAll(query);
        if (queryResult.length === 0) {
          expect.fail(function (output) {
            output.error('The selector').sp().jsString(query).sp().error('yielded no results');
          });
        }
      }
      return expect.shift(queryResult);
    });

    expect.addAssertion('<DOMDocument|DOMElement|DOMDocumentFragment> to contain [no] elements matching <string>', function (expect, subject, query) {
      if (expect.flags.no) {
        return expect(subject.querySelectorAll(query), 'to satisfy', []);
      }
      return expect(subject.querySelectorAll(query), 'not to satisfy', []);
    });

    expect.addAssertion('<DOMDocument|DOMElement|DOMDocumentFragment> [not] to match <string>', function (expect, subject, query) {
      return expect(matchesSelector(subject, query), 'to be', (expect.flags.not ? false : true));
    });

    expect.addAssertion('<string> [when] parsed as (html|HTML) [fragment] <assertion?>', function (expect, subject) {
      expect.errorMode = 'nested';
      return expect.shift(parseHtml(subject, expect.flags.fragment, expect.testDescription));
    });

    expect.addAssertion('<string> [when] parsed as (xml|XML) <assertion?>', function (expect, subject) {
      expect.errorMode = 'nested';
      return expect.shift(parseXml(subject, expect.testDescription));
    });
  }
};

},{"./matchesSelector":2,"magicpen-prism":4}],2:[function(require,module,exports){
module.exports = function (elm, selector) {
  var matchFuntion = elm.matchesSelector ||
    elm.mozMatchesSelector ||
    elm.msMatchesSelector ||
    elm.oMatchesSelector ||
    elm.webkitMatchesSelector ||
    function (selector) {
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


/* **********************************************
     Begin prism-core.js
********************************************** */

var self = (typeof window !== 'undefined') ? window : {};

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;

var _ = self.Prism = {
	util: {
		type: function (o) { 
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
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
					return o.slice();
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
		
		// Insert a token before another token in a language literal
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];
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
			
			return root[inside] = ret;
		},
		
		// Traverse a language definition with Depth First Search
		DFS: function(o, callback) {
			for (var i in o) {
				callback.call(o, i, o[i]);
				
				if (_.util.type(o) === 'Object') {
					_.languages.DFS(o[i], callback);
				}
			}
		}
	},

	highlightAll: function(async, callback) {
		var elements = document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, callback);
		}
	},
		
	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;
		
		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}
		
		if (parent) {
			language = (parent.className.match(lang) || [,''])[1];
			grammar = _.languages[language];
		}

		if (!grammar) {
			return;
		}
		
		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		
		// Set language on the parent, for styling
		parent = element.parentNode;
		
		if (/pre/i.test(parent.nodeName)) {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language; 
		}

		var code = element.textContent;
		
		if(!code) {
			return;
		}
		
		code = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
		
		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};
		
		_.hooks.run('before-highlight', env);
		
		if (async && self.Worker) {
			var worker = new Worker(_.filename);	
			
			worker.onmessage = function(evt) {
				env.highlightedCode = Token.stringify(JSON.parse(evt.data), language);

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;
				
				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
			};
			
			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language)

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;
			
			callback && callback.call(element);
			
			_.hooks.run('after-highlight', env);
		}
	},
	
	highlight: function (text, grammar, language) {
		return Token.stringify(_.tokenize(text, grammar), language);
	},
	
	tokenize: function(text, grammar, language) {
		var Token = _.Token;
		
		var strarr = [text];
		
		var rest = grammar.rest;
		
		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}
			
			delete grammar.rest;
		}
								
		tokenloop: for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}
			
			var pattern = grammar[token], 
				inside = pattern.inside,
				lookbehind = !!pattern.lookbehind,
				lookbehindLength = 0;
			
			pattern = pattern.pattern || pattern;
			
			for (var i=0; i<strarr.length; i++) { // Don’t cache length as it changes during the loop
				
				var str = strarr[i];
				
				if (strarr.length > text.length) {
					// Something went terribly wrong, ABORT, ABORT!
					break tokenloop;
				}
				
				if (str instanceof Token) {
					continue;
				}
				
				pattern.lastIndex = 0;
				
				var match = pattern.exec(str);
				
				if (match) {
					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index - 1 + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    len = match.length,
					    to = from + len,
						before = str.slice(0, from + 1),
						after = str.slice(to + 1); 

					var args = [i, 1];
					
					if (before) {
						args.push(before);
					}
					
					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match);
					
					args.push(wrapped);
					
					if (after) {
						args.push(after);
					}
					
					Array.prototype.splice.apply(strarr, args);
				}
			}
		}

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

var Token = _.Token = function(type, content) {
	this.type = type;
	this.content = content;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (Object.prototype.toString.call(o) == '[object Array]') {
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
	
	if (env.type == 'comment') {
		env.attributes['spellcheck'] = 'true';
	}
	
	_.hooks.run('wrap', env);
	
	var attributes = '';
	
	for (var name in env.attributes) {
		attributes += name + '="' + (env.attributes[name] || '') + '"';
	}
	
	return '<' + env.tag + ' class="' + env.classes.join(' ') + '" ' + attributes + '>' + env.content + '</' + env.tag + '>';
	
};

if (!self.document) {
	if (!self.addEventListener) {
		// in Node.js
		return self.Prism;
	}
 	// In worker
	self.addEventListener('message', function(evt) {
		var message = JSON.parse(evt.data),
		    lang = message.language,
		    code = message.code;
		
		self.postMessage(JSON.stringify(_.tokenize(code, _.languages[lang])));
		self.close();
	}, false);
	
	return self.Prism;
}

// Get current script and highlight
var script = document.getElementsByTagName('script');

script = script[script.length - 1];

if (script) {
	_.filename = script.src;
	
	if (document.addEventListener && !script.hasAttribute('data-manual')) {
		document.addEventListener('DOMContentLoaded', _.highlightAll);
	}
}

return self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /&lt;!--[\w\W]*?-->/g,
	'prolog': /&lt;\?.+?\?>/,
	'doctype': /&lt;!DOCTYPE.+?>/,
	'cdata': /&lt;!\[CDATA\[[\w\W]*?]]>/i,
	'tag': {
		pattern: /&lt;\/?[\w:-]+\s*(?:\s+[\w:-]+(?:=(?:("|')(\\?[\w\W])*?\1|[^\s'">=]+))?\s*)*\/?>/gi,
		inside: {
			'tag': {
				pattern: /^&lt;\/?[\w:-]+/i,
				inside: {
					'punctuation': /^&lt;\/?/,
					'namespace': /^[\w-]+?:/
				}
			},
			'attr-value': {
				pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/gi,
				inside: {
					'punctuation': /=|>|"/g
				}
			},
			'punctuation': /\/?>/g,
			'attr-name': {
				pattern: /[\w:-]+/g,
				inside: {
					'namespace': /^[\w-]+?:/
				}
			}
			
		}
	},
	'entity': /&amp;#?[\da-z]{1,8};/gi
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\w\W]*?\*\//g,
	'atrule': {
		pattern: /@[\w-]+?.*?(;|(?=\s*{))/gi,
		inside: {
			'punctuation': /[;:]/g
		}
	},
	'url': /url\((["']?).*?\1\)/gi,
	'selector': /[^\{\}\s][^\{\};]*(?=\s*\{)/g,
	'property': /(\b|\B)[\w-]+(?=\s*:)/ig,
	'string': /("|')(\\?.)*?\1/g,
	'important': /\B!important\b/gi,
	'ignore': /&(lt|gt|amp);/gi,
	'punctuation': /[\{\};:]/g
};

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(&lt;|<)style[\w\W]*?(>|&gt;)[\w\W]*?(&lt;|<)\/style(>|&gt;)/ig,
			inside: {
				'tag': {
					pattern: /(&lt;|<)style[\w\W]*?(>|&gt;)|(&lt;|<)\/style(>|&gt;)/ig,
					inside: Prism.languages.markup.tag.inside
				},
				rest: Prism.languages.css
			}
		}
	});
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': {
		pattern: /(^|[^\\])(\/\*[\w\W]*?\*\/|(^|[^:])\/\/.*?(\r?\n|$))/g,
		lookbehind: true
	},
	'string': /("|')(\\?.)*?\1/g,
	'class-name': {
		pattern: /((?:(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/ig,
		lookbehind: true,
		inside: {
			punctuation: /(\.|\\)/
		}
	},
	'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/g,
	'boolean': /\b(true|false)\b/g,
	'function': {
		pattern: /[a-z0-9_]+\(/ig,
		inside: {
			punctuation: /\(/
		}
	},
	'number': /\b-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee]-?\d+)?)\b/g,
	'operator': /[-+]{1,2}|!|&lt;=?|>=?|={1,3}|(&amp;){1,2}|\|?\||\?|\*|\/|\~|\^|\%/g,
	'ignore': /&(lt|gt|amp);/gi,
	'punctuation': /[{}[\];(),.:]/g
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(var|let|if|else|while|do|for|return|in|instanceof|function|get|set|new|with|typeof|try|throw|catch|finally|null|break|continue|this)\b/g,
	'number': /\b-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee]-?\d+)?|NaN|-?Infinity)\b/g
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/g,
		lookbehind: true
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(&lt;|<)script[\w\W]*?(>|&gt;)[\w\W]*?(&lt;|<)\/script(>|&gt;)/ig,
			inside: {
				'tag': {
					pattern: /(&lt;|<)script[\w\W]*?(>|&gt;)|(&lt;|<)\/script(>|&gt;)/ig,
					inside: Prism.languages.markup.tag.inside
				},
				rest: Prism.languages.javascript
			}
		}
	});
}


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function(){

if (!self.Prism || !self.document || !document.querySelector) {
	return;
}

var Extensions = {
	'js': 'javascript',
	'html': 'markup',
	'svg': 'markup'
};

Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function(pre) {
	var src = pre.getAttribute('data-src');
	var extension = (src.match(/\.(\w+)$/) || [,''])[1];
	var language = Extensions[extension] || extension;
	
	var code = document.createElement('code');
	code.className = 'language-' + language;
	
	pre.textContent = '';
	
	code.textContent = 'Loading…';
	
	pre.appendChild(code);
	
	var xhr = new XMLHttpRequest();
	
	xhr.open('GET', src, true);

	xhr.onreadystatechange = function() {
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

})();
},{}],4:[function(require,module,exports){
var prism = require('../3rdparty/prism'),
    defaultTheme = {
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
    },
    languageMapping = {
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
        java: 'clike'
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

            sourceText = sourceText.replace(/</g, '&lt;'); // Prismism

            var that = this,
                capitalizedLanguage = upperCamelCase(language);

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

},{"../3rdparty/prism":3,"../package.json":5}],5:[function(require,module,exports){
module.exports={
  "name": "magicpen-prism",
  "version": "2.2.1",
  "description": "Add syntax highlighting support to magicpen via prism.js",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/unexpectedjs/magicpen-prism.git"
  },
  "main": "lib/magicPenPrism.js",
  "author": {
    "name": "Andreas Lind Petersen",
    "email": "andreas@one.com"
  },
  "devDependencies": {
    "browserify": "8.1.1",
    "bundle-collapser": "1.1.1",
    "jshint": "2.7.0",
    "magicpen": "4.3.1",
    "mocha": "1.21.4",
    "unexpected": "5.8.0"
  },
  "files": [
    "lib",
    "magicPenPrism.min.js",
    "3rdparty/prism.js"
  ],
  "scripts": {
    "test": "mocha",
    "lint": "jshint .",
    "travis": "npm run lint && npm test",
    "prepublish": "browserify -p bundle-collapser/plugin -e lib/magicPenPrism -s magicPenPrism > magicPenPrism.min.js"
  },
  "gitHead": "88da937c20daf1a11dd4206e5dcfe036109f5ce9",
  "bugs": {
    "url": "https://github.com/unexpectedjs/magicpen-prism/issues"
  },
  "homepage": "https://github.com/unexpectedjs/magicpen-prism#readme",
  "_id": "magicpen-prism@2.2.1",
  "_shasum": "90a224968b512f769506dc65188995821681b631",
  "_from": "magicpen-prism@>=2.2.1 <3.0.0",
  "_npmVersion": "2.14.2",
  "_nodeVersion": "0.10.40",
  "_npmUser": {
    "name": "papandreou",
    "email": "andreas@one.com"
  },
  "dist": {
    "shasum": "90a224968b512f769506dc65188995821681b631",
    "tarball": "http://registry.npmjs.org/magicpen-prism/-/magicpen-prism-2.2.1.tgz"
  },
  "maintainers": [
    {
      "name": "papandreou",
      "email": "andreas@one.com"
    },
    {
      "name": "sunesimonsen",
      "email": "sune@we-knowhow.dk"
    }
  ],
  "directories": {},
  "_resolved": "https://registry.npmjs.org/magicpen-prism/-/magicpen-prism-2.2.1.tgz",
  "readme": "ERROR: No README data found!"
}

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvbWF0Y2hlc1NlbGVjdG9yLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtLzNyZHBhcnR5L3ByaXNtLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL2xpYi9tYWdpY1BlblByaXNtLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL3BhY2thZ2UuanNvbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDLzZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgbWF0Y2hlc1NlbGVjdG9yID0gcmVxdWlyZSgnLi9tYXRjaGVzU2VsZWN0b3InKTtcblxuZnVuY3Rpb24gcGFyc2VIdG1sKHN0ciwgaXNGcmFnbWVudCwgYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSkge1xuICBpZiAoaXNGcmFnbWVudCkge1xuICAgIHN0ciA9ICc8aHRtbD48aGVhZD48L2hlYWQ+PGJvZHk+JyArIHN0ciArICc8L2JvZHk+PC9odG1sPic7XG4gIH1cbiAgdmFyIGh0bWxEb2N1bWVudDtcbiAgaWYgKHR5cGVvZiBET01QYXJzZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaHRtbERvY3VtZW50ID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhzdHIsICd0ZXh0L2h0bWwnKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmltcGxlbWVudGF0aW9uICYmIGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCkge1xuICAgIGh0bWxEb2N1bWVudCA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCgnJyk7XG4gICAgaHRtbERvY3VtZW50Lm9wZW4oKTtcbiAgICBodG1sRG9jdW1lbnQud3JpdGUoc3RyKTtcbiAgICBodG1sRG9jdW1lbnQuY2xvc2UoKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIganNkb207XG4gICAgdHJ5IHtcbiAgICAgIGpzZG9tID0gcmVxdWlyZSgnJyArICdqc2RvbScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkLWRvbScgKyAoYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSA/ICcgKCcgKyBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlICsgJyknIDogJycpICsgJzogUnVubmluZyBvdXRzaWRlIGEgYnJvd3NlciwgYnV0IGNvdWxkIG5vdCBmaW5kIHRoZSBganNkb21gIG1vZHVsZS4gUGxlYXNlIG5wbSBpbnN0YWxsIGpzZG9tIHRvIG1ha2UgdGhpcyB3b3JrLicpO1xuICAgIH1cbiAgICBodG1sRG9jdW1lbnQgPSBqc2RvbS5qc2RvbShzdHIpO1xuICB9XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgdmFyIGJvZHkgPSBodG1sRG9jdW1lbnQuYm9keTtcbiAgICB2YXIgZG9jdW1lbnRGcmFnbWVudCA9IGh0bWxEb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgaWYgKGJvZHkpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGJvZHkuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgZG9jdW1lbnRGcmFnbWVudC5hcHBlbmRDaGlsZChib2R5LmNoaWxkTm9kZXNbaV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRvY3VtZW50RnJhZ21lbnQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGh0bWxEb2N1bWVudDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZVhtbChzdHIsIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UpIHtcbiAgaWYgKHR5cGVvZiBET01QYXJzZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoc3RyLCAndGV4dC94bWwnKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIganNkb207XG4gICAgdHJ5IHtcbiAgICAgIGpzZG9tID0gcmVxdWlyZSgnJyArICdqc2RvbScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkLWRvbScgKyAoYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSA/ICcgKCcgKyBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlICsgJyknIDogJycpICsgJzogUnVubmluZyBvdXRzaWRlIGEgYnJvd3NlciAob3IgaW4gYSBicm93c2VyIHdpdGhvdXQgRE9NUGFyc2VyKSwgYnV0IGNvdWxkIG5vdCBmaW5kIHRoZSBganNkb21gIG1vZHVsZS4gUGxlYXNlIG5wbSBpbnN0YWxsIGpzZG9tIHRvIG1ha2UgdGhpcyB3b3JrLicpO1xuICAgIH1cbiAgICByZXR1cm4ganNkb20uanNkb20oc3RyLCB7IHBhcnNpbmdNb2RlOiAneG1sJyB9KTtcbiAgfVxufVxuXG4vLyBGcm9tIGh0bWwtbWluaWZpZXJcbnZhciBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzID0ge1xuICBkcmFnZ2FibGU6IFsndHJ1ZScsICdmYWxzZSddIC8vIGRlZmF1bHRzIHRvICdhdXRvJ1xufTtcblxuZnVuY3Rpb24gaXNCb29sZWFuQXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsdWUpIHtcbiAgdmFyIGlzU2ltcGxlQm9vbGVhbiA9ICgvXig/OmFsbG93ZnVsbHNjcmVlbnxhc3luY3xhdXRvZm9jdXN8YXV0b3BsYXl8Y2hlY2tlZHxjb21wYWN0fGNvbnRyb2xzfGRlY2xhcmV8ZGVmYXVsdHxkZWZhdWx0Y2hlY2tlZHxkZWZhdWx0bXV0ZWR8ZGVmYXVsdHNlbGVjdGVkfGRlZmVyfGRpc2FibGVkfGVuYWJsZWR8Zm9ybW5vdmFsaWRhdGV8aGlkZGVufGluZGV0ZXJtaW5hdGV8aW5lcnR8aXNtYXB8aXRlbXNjb3BlfGxvb3B8bXVsdGlwbGV8bXV0ZWR8bm9ocmVmfG5vcmVzaXplfG5vc2hhZGV8bm92YWxpZGF0ZXxub3dyYXB8b3BlbnxwYXVzZW9uZXhpdHxyZWFkb25seXxyZXF1aXJlZHxyZXZlcnNlZHxzY29wZWR8c2VhbWxlc3N8c2VsZWN0ZWR8c29ydGFibGV8c3BlbGxjaGVja3x0cnVlc3BlZWR8dHlwZW11c3RtYXRjaHx2aXNpYmxlKSQvaSkudGVzdChhdHRyTmFtZSk7XG4gIGlmIChpc1NpbXBsZUJvb2xlYW4pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBhdHRyVmFsdWVFbnVtZXJhdGlvbiA9IGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXNbYXR0ck5hbWUudG9Mb3dlckNhc2UoKV07XG4gIGlmICghYXR0clZhbHVlRW51bWVyYXRpb24pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZWxzZSB7XG4gICAgcmV0dXJuICgtMSA9PT0gYXR0clZhbHVlRW51bWVyYXRpb24uaW5kZXhPZihhdHRyVmFsdWUudG9Mb3dlckNhc2UoKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0eWxlU3RyaW5nVG9PYmplY3Qoc3RyKSB7XG4gIHZhciBzdHlsZXMgPSB7fTtcblxuICBzdHIuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uIChydWxlKSB7XG4gICAgdmFyIHR1cGxlID0gcnVsZS5zcGxpdCgnOicpLm1hcChmdW5jdGlvbiAocGFydCkgeyByZXR1cm4gcGFydC50cmltKCk7IH0pO1xuXG4gICAgLy8gR3VhcmQgYWdhaW5zdCBlbXB0eSB0b3VwbGVzXG4gICAgaWYgKHR1cGxlWzBdICYmIHR1cGxlWzFdKSB7XG4gICAgICBzdHlsZXNbdHVwbGVbMF1dID0gdHVwbGVbMV07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gc3R5bGVzO1xufVxuXG5mdW5jdGlvbiBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZVZhbHVlKSB7XG4gIGlmIChhdHRyaWJ1dGVWYWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIHZhciBjbGFzc05hbWVzID0gYXR0cmlidXRlVmFsdWUuc3BsaXQoL1xccysvKTtcbiAgaWYgKGNsYXNzTmFtZXMubGVuZ3RoID09PSAxICYmIGNsYXNzTmFtZXNbMF0gPT09ICcnKSB7XG4gICAgY2xhc3NOYW1lcy5wb3AoKTtcbiAgfVxuICByZXR1cm4gY2xhc3NOYW1lcztcbn1cblxuZnVuY3Rpb24gaXNJbnNpZGVIdG1sRG9jdW1lbnQobm9kZSkge1xuICB2YXIgb3duZXJEb2N1bWVudDtcbiAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDkgJiYgbm9kZS5kb2N1bWVudEVsZW1lbnQgJiYgbm9kZS5pbXBsZW1lbnRhdGlvbikge1xuICAgIG93bmVyRG9jdW1lbnQgPSBub2RlO1xuICB9IGVsc2Uge1xuICAgIG93bmVyRG9jdW1lbnQgPSBub2RlLm93bmVyRG9jdW1lbnQ7XG4gIH1cbiAgaWYgKG93bmVyRG9jdW1lbnQuY29udGVudFR5cGUpIHtcbiAgICByZXR1cm4gb3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG93bmVyRG9jdW1lbnQudG9TdHJpbmcoKSA9PT0gJ1tvYmplY3QgSFRNTERvY3VtZW50XSc7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXR0cmlidXRlcyhlbGVtZW50KSB7XG4gIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChlbGVtZW50KTtcbiAgdmFyIGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChhdHRyc1tpXS5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBhdHRyc1tpXS52YWx1ZSAmJiBhdHRyc1tpXS52YWx1ZS5zcGxpdCgnICcpIHx8IFtdO1xuICAgIH0gZWxzZSBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gc3R5bGVTdHJpbmdUb09iamVjdChhdHRyc1tpXS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cnNbaV0ubmFtZSkgPyB0cnVlIDogKGF0dHJzW2ldLnZhbHVlIHx8ICcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBlbnRpdGlmeSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpIHtcbiAgcmV0dXJuICgvKD86YXJlYXxiYXNlfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKS9pKS50ZXN0KGVsZW1lbnROYW1lKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgdmFsdWUsIGlzSHRtbCkge1xuICBvdXRwdXQucHJpc21BdHRyTmFtZShhdHRyaWJ1dGVOYW1lKTtcbiAgaWYgKCFpc0h0bWwgfHwgIWlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSkge1xuICAgIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLmpvaW4oJyAnKTtcbiAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgIHZhbHVlID0gT2JqZWN0LmtleXModmFsdWUpLm1hcChmdW5jdGlvbiAoY3NzUHJvcCkge1xuICAgICAgICByZXR1cm4gY3NzUHJvcCArICc6ICcgKyB2YWx1ZVtjc3NQcm9wXTtcbiAgICAgIH0pLmpvaW4oJzsgJyk7XG4gICAgfVxuICAgIG91dHB1dFxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJz1cIicpXG4gICAgICAucHJpc21BdHRyVmFsdWUoZW50aXRpZnkodmFsdWUpKVxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJ1wiJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZTtcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgcmV0dXJuICdjbGFzcz1cIicgKyB2YWx1ZS5qb2luKCcgJykgKyAnXCInOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgcmV0dXJuICdzdHlsZT1cIicgKyBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKGZ1bmN0aW9uIChjc3NQcm9wKSB7XG4gICAgICByZXR1cm4gW2Nzc1Byb3AsIHZhbHVlW2Nzc1Byb3BdXS5qb2luKCc6ICcpOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgICB9KS5qb2luKCc7ICcpICsgJ1wiJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZSArICc9XCInICsgZW50aXRpZnkodmFsdWUpICsgJ1wiJztcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCcgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICB2YXIgc3RyID0gJzwnICsgZWxlbWVudE5hbWU7XG4gIHZhciBhdHRycyA9IGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCk7XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHN0ciArPSAnICcgKyBzdHJpbmdpZnlBdHRyaWJ1dGUoa2V5LCBhdHRyc1trZXldKTtcbiAgfSk7XG5cbiAgc3RyICs9ICc+JztcbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGVsZW1lbnQpO1xuICB2YXIgZWxlbWVudE5hbWUgPSBpc0h0bWwgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICBpZiAoaXNIdG1sICYmIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJyc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICc8LycgKyBlbGVtZW50TmFtZSArICc+JztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbmFtZTogJ3VuZXhwZWN0ZWQtZG9tJyxcbiAgaW5zdGFsbEludG86IGZ1bmN0aW9uIChleHBlY3QpIHtcbiAgICBleHBlY3QuaW5zdGFsbFBsdWdpbihyZXF1aXJlKCdtYWdpY3Blbi1wcmlzbScpKTtcbiAgICB2YXIgdG9wTGV2ZWxFeHBlY3QgPSBleHBlY3Q7XG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGUnLFxuICAgICAgYmFzZTogJ29iamVjdCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlTmFtZSAmJiBbMiwgMywgNCwgNSwgNiwgNywgMTAsIDExLCAxMl0uaW5kZXhPZihvYmoubm9kZVR5cGUpID4gLTE7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVsZW1lbnQubm9kZU5hbWUgKyAnIFwiJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJ1wiJywgJ3ByaXNtLXN0cmluZycpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUNvbW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDg7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKCc8IS0tJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJy0tPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IS0tJyArIGFjdHVhbC5ub2RlVmFsdWUgKyAnLS0+JywgJzwhLS0nICsgZXhwZWN0ZWQubm9kZVZhbHVlICsgJy0tPicpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTVRleHROb2RlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUgPT09IGIubm9kZVZhbHVlO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChlbGVtZW50LCBkZXB0aCwgb3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZShlbnRpdGlmeShlbGVtZW50Lm5vZGVWYWx1ZS50cmltKCkpLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihhY3R1YWwubm9kZVZhbHVlLCBleHBlY3RlZC5ub2RlVmFsdWUpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdhcnJheS1saWtlJyxcbiAgICAgIHByZWZpeDogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ05vZGVMaXN0WycpO1xuICAgICAgfSxcbiAgICAgIHN1ZmZpeDogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ10nKTtcbiAgICAgIH0sXG4gICAgICBzaW1pbGFyOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAvLyBGaWd1cmUgb3V0IHdoZXRoZXIgYSBhbmQgYiBhcmUgXCJzdHJ1dHVyYWxseSBzaW1pbGFyXCIgc28gdGhleSBjYW4gYmUgZGlmZmVkIGlubGluZS5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBhLm5vZGVUeXBlID09PSAxICYmIGIubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgICAgICBhLm5vZGVOYW1lID09PSBiLm5vZGVOYW1lXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBvYmogJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLmxlbmd0aCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLnRvU3RyaW5nID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5pdGVtID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgLy8gV2l0aCBqc2RvbSA2Kywgbm9kZUxpc3QudG9TdHJpbmcoKSBjb21lcyBvdXQgYXMgJ1tvYmplY3QgT2JqZWN0XScsIHNvIGZhbGwgYmFjayB0byB0aGUgY29uc3RydWN0b3IgbmFtZTpcbiAgICAgICAgICAob2JqLnRvU3RyaW5nKCkuaW5kZXhPZignTm9kZUxpc3QnKSAhPT0gLTEgfHwgKG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IubmFtZSA9PT0gJ05vZGVMaXN0JykpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBGYWtlIHR5cGUgdG8gbWFrZSBpdCBwb3NzaWJsZSB0byBidWlsZCAndG8gc2F0aXNmeScgZGlmZnMgdG8gYmUgcmVuZGVyZWQgaW5saW5lOlxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdhdHRhY2hlZERPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlTGlzdCcsXG4gICAgICBpbmRlbnQ6IGZhbHNlLFxuICAgICAgcHJlZml4OiBmdW5jdGlvbiAob3V0cHV0KSB7IHJldHVybiBvdXRwdXQ7IH0sXG4gICAgICBzdWZmaXg6IGZ1bmN0aW9uIChvdXRwdXQpIHsgcmV0dXJuIG91dHB1dDsgfSxcbiAgICAgIGRlbGltaXRlcjogZnVuY3Rpb24gKG91dHB1dCkgeyByZXR1cm4gb3V0cHV0OyB9LFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmouX2lzQXR0YWNoZWRET01Ob2RlTGlzdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGRvbU5vZGVMaXN0LCBjb250ZW50VHlwZSkge1xuICAgICAgdmFyIGF0dGFjaGVkRE9NTm9kZUxpc3QgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRvbU5vZGVMaXN0Lmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICBhdHRhY2hlZERPTU5vZGVMaXN0LnB1c2goZG9tTm9kZUxpc3RbaV0pO1xuICAgICAgfVxuICAgICAgYXR0YWNoZWRET01Ob2RlTGlzdC5faXNBdHRhY2hlZERPTU5vZGVMaXN0ID0gdHJ1ZTtcbiAgICAgIGF0dGFjaGVkRE9NTm9kZUxpc3Qub3duZXJEb2N1bWVudCA9IHsgY29udGVudFR5cGU6IGNvbnRlbnRUeXBlIH07XG4gICAgICByZXR1cm4gYXR0YWNoZWRET01Ob2RlTGlzdDtcbiAgICB9XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnSFRNTERvY1R5cGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDEwICYmICdwdWJsaWNJZCcgaW4gb2JqO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChkb2N0eXBlLCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8IURPQ1RZUEUgJyArIGRvY3R5cGUubmFtZSArICc+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IURPQ1RZUEUgJyArIGFjdHVhbC5uYW1lICsgJz4nLCAnPCFET0NUWVBFICcgKyBleHBlY3RlZC5uYW1lICsgJz4nKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Eb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gOSAmJiBvYmouZG9jdW1lbnRFbGVtZW50ICYmIG9iai5pbXBsZW1lbnRhdGlvbjtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIHJlc3VsdC5kaWZmLmFwcGVuZChkaWZmKG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGFjdHVhbC5jaGlsZE5vZGVzKSwgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoZXhwZWN0ZWQuY2hpbGROb2RlcykpLmRpZmYpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmFzZVR5cGUuaWRlbnRpZnkob2JqKSAmJiBvYmouY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ1hNTERvY3VtZW50JyxcbiAgICAgIGJhc2U6ICdET01Eb2N1bWVudCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIC9eKD86YXBwbGljYXRpb258dGV4dClcXC94bWx8XFwreG1sXFxiLy50ZXN0KG9iai5jb250ZW50VHlwZSk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8P3htbCB2ZXJzaW9uPVwiMS4wXCI/PicsICd4bWwnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSwgZGVwdGggLSAxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Eb2N1bWVudEZyYWdtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxMTsgLy8gSW4ganNkb20sIGRvY3VtZW50RnJhZ21lbnQudG9TdHJpbmcoKSBkb2VzIG5vdCByZXR1cm4gW29iamVjdCBEb2N1bWVudEZyYWdtZW50XVxuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChkb2N1bWVudEZyYWdtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC50ZXh0KCdEb2N1bWVudEZyYWdtZW50WycpLmFwcGVuZChpbnNwZWN0KGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2RlcywgZGVwdGgpKS50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIHJlc3VsdC5kaWZmLmJsb2NrKGRpZmYobWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoYWN0dWFsLmNoaWxkTm9kZXMpLCBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChleHBlY3RlZC5jaGlsZE5vZGVzKSkuZGlmZik7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRWxlbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gMSAmJiBvYmoubm9kZU5hbWUgJiYgb2JqLmF0dHJpYnV0ZXM7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiLCBlcXVhbCkge1xuICAgICAgICB2YXIgYUlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGEpO1xuICAgICAgICB2YXIgYklzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGIpO1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIGFJc0h0bWwgPT09IGJJc0h0bWwgJiZcbiAgICAgICAgICAoYUlzSHRtbCA/IGEubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gYi5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIDogYS5ub2RlTmFtZSA9PT0gYi5ub2RlTmFtZSkgJiZcbiAgICAgICAgICBlcXVhbChnZXRBdHRyaWJ1dGVzKGEpLCBnZXRBdHRyaWJ1dGVzKGIpKSAmJiBlcXVhbChhLmNoaWxkTm9kZXMsIGIuY2hpbGROb2RlcylcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBzdGFydFRhZyA9IHN0cmluZ2lmeVN0YXJ0VGFnKGVsZW1lbnQpO1xuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0YXJ0VGFnLCAnaHRtbCcpO1xuICAgICAgICBpZiAoZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgIGlmIChkZXB0aCA9PT0gMSkge1xuICAgICAgICAgICAgICBvdXRwdXQudGV4dCgnLi4uJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBpbnNwZWN0ZWRDaGlsZHJlbiA9IFtdO1xuICAgICAgICAgICAgaWYgKGVsZW1lbnROYW1lID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgICB2YXIgdHlwZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJyk7XG4gICAgICAgICAgICAgIGlmICghdHlwZSB8fCAvamF2YXNjcmlwdC8udGVzdCh0eXBlKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnamF2YXNjcmlwdCc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIHR5cGUpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJykgfHwgJ3RleHQvY3NzJykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2goaW5zcGVjdChlbGVtZW50LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd2lkdGggPSAwO1xuICAgICAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgIHZhciBzaXplID0gby5zaXplKCk7XG4gICAgICAgICAgICAgIHdpZHRoICs9IHNpemUud2lkdGg7XG4gICAgICAgICAgICAgIHJldHVybiB3aWR0aCA+IDUwIHx8IG8uaGVpZ2h0ID4gMTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAobXVsdGlwbGVMaW5lcykge1xuICAgICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuXG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5pKCkuYmxvY2soaW5zcGVjdGVkQ2hpbGQpLm5sKCk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIG91dHB1dC5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdGVkQ2hpbGQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIGRpZmZMaW1pdDogNTEyLFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGFjdHVhbCk7XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgZGlmZjogb3V0cHV0LFxuICAgICAgICAgIGlubGluZTogdHJ1ZVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpID4gdGhpcy5kaWZmTGltaXQpIHtcbiAgICAgICAgICByZXN1bHQuZGlmZi5qc0NvbW1lbnQoJ0RpZmYgc3VwcHJlc3NlZCBkdWUgdG8gc2l6ZSA+ICcgKyB0aGlzLmRpZmZMaW1pdCk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbXB0eUVsZW1lbnRzID0gYWN0dWFsLmNoaWxkTm9kZXMubGVuZ3RoID09PSAwICYmIGV4cGVjdGVkLmNoaWxkTm9kZXMubGVuZ3RoID09PSAwO1xuICAgICAgICB2YXIgY29uZmxpY3RpbmdFbGVtZW50ID0gYWN0dWFsLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgIT09IGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgfHwgIWVxdWFsKGdldEF0dHJpYnV0ZXMoYWN0dWFsKSwgZ2V0QXR0cmlidXRlcyhleHBlY3RlZCkpO1xuXG4gICAgICAgIGlmIChjb25mbGljdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgICB2YXIgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc8JylcbiAgICAgICAgICAgIC5wcmlzbVRhZyhhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgaWYgKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgYmUnKS5zcCgpLnByaXNtVGFnKGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgYWN0dWFsQXR0cmlidXRlcyA9IGdldEF0dHJpYnV0ZXMoYWN0dWFsKTtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhleHBlY3RlZCk7XG4gICAgICAgICAgT2JqZWN0LmtleXMoYWN0dWFsQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgYWN0dWFsLm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4ob3V0cHV0LCBhdHRyaWJ1dGVOYW1lLCBhY3R1YWxBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZU5hbWUgaW4gZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgIGlmIChhY3R1YWxBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID09PSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0pIHtcbiAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgZXF1YWwnKS5zcCgpLmFwcGVuZChpbnNwZWN0KGVudGl0aWZ5KGV4cGVjdGVkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkpKTtcbiAgICAgICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ3Nob3VsZCBiZSByZW1vdmVkJyk7XG4gICAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgYWN0dWFsLm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICBvdXRwdXQuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgdGhpcy5lcnJvcignbWlzc2luZycpLnNwKCk7XG4gICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1Blbih0aGlzLCBhdHRyaWJ1dGVOYW1lLCBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0sIGlzSHRtbCk7XG4gICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgb3V0cHV0LnByaXNtUHVuY3R1YXRpb24oJz4nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlTdGFydFRhZyhhY3R1YWwpLCAnaHRtbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbXB0eUVsZW1lbnRzKSB7XG4gICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgIC5pKClcbiAgICAgICAgICAgIC5ibG9jayhkaWZmKG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGFjdHVhbC5jaGlsZE5vZGVzKSwgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoZXhwZWN0ZWQuY2hpbGROb2RlcykpLmRpZmYpXG4gICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgLm91dGRlbnRMaW5lcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gaGF2ZSAoY2xhc3N8Y2xhc3NlcykgPGFycmF5fHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywgeyBjbGFzczogdmFsdWUgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gb25seSBoYXZlIChjbGFzc3xjbGFzc2VzKSA8YXJyYXl8c3RyaW5nPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBoYXZlIGF0dHJpYnV0ZXMnLCB7XG4gICAgICAgIGNsYXNzOiBmdW5jdGlvbiAoY2xhc3NOYW1lKSB7XG4gICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhbHVlID0gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZSh2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChhY3R1YWxDbGFzc2VzLnNvcnQoKSwgJ3RvIGVxdWFsJywgdmFsdWUuc29ydCgpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTVRleHROb2RlPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3Qubm9kZVZhbHVlLCAndG8gZXF1YWwnLCB2YWx1ZS5ub2RlVmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxvYmplY3Q+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIGV4cGVjdC5mYWlsKCk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPGFueT4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0Lm5vZGVWYWx1ZSwgJ3RvIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMobm9kZSwgaXNIdG1sKSB7XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gMSB8fCBub2RlLm5vZGVUeXBlID09PSAxMCkge1xuICAgICAgICAvLyBET01FbGVtZW50IG9yIEhUTUxEb2NUeXBlXG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgbmFtZTogaXNIdG1sID8gbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIDogbm9kZS5ub2RlTmFtZVxuICAgICAgICB9O1xuICAgICAgICBpZiAobm9kZS5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgcmVzdWx0LmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUuYXR0cmlidXRlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzW25vZGUuYXR0cmlidXRlc1tpXS5uYW1lXSA9IGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUobm9kZS5hdHRyaWJ1dGVzW2ldLm5hbWUpID8gdHJ1ZSA6IChub2RlLmF0dHJpYnV0ZXNbaV0udmFsdWUgfHwgJycpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuY2hpbGRyZW4gPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwobm9kZS5jaGlsZE5vZGVzLCBmdW5jdGlvbiAoY2hpbGROb2RlKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIC8vIERPTVRleHROb2RlXG4gICAgICAgIHJldHVybiBub2RlLm5vZGVWYWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndG8gc2F0aXNmeTogTm9kZSB0eXBlICcgKyBub2RlLm5vZGVUeXBlICsgJyBpcyBub3QgeWV0IHN1cHBvcnRlZCBpbiB0aGUgdmFsdWUnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCc8RE9NTm9kZUxpc3Q+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IHN1YmplY3Qub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgb3V0cHV0LmNvZGUodmFsdWUsIGlzSHRtbCA/ICdodG1sJyA6ICd4bWwnKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgKGlzSHRtbCA/IHBhcnNlSHRtbCh2YWx1ZSwgdHJ1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbikgOiBwYXJzZVhtbCh2YWx1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbikpLmNoaWxkTm9kZXMpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTU5vZGVMaXN0PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01Ob2RlTGlzdD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IHN1YmplY3Qub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gICAgICB2YXIgc2F0aXNmeVNwZWNzID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCB2YWx1ZS5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgc2F0aXNmeVNwZWNzLnB1c2goY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlW2ldLCBpc0h0bWwpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBzYXRpc2Z5U3BlY3MpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTURvY3VtZW50RnJhZ21lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuICAgICAgZXhwZWN0LmFyZ3NPdXRwdXQgPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKHZhbHVlLCBpc0h0bWwgPyAnaHRtbCcgOiAneG1sJyk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGlzSHRtbCA/IHBhcnNlSHRtbCh2YWx1ZSwgdHJ1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbikgOiBwYXJzZVhtbCh2YWx1ZSwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbikpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTURvY3VtZW50RnJhZ21lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTURvY3VtZW50RnJhZ21lbnQ+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBpc0h0bWwgPSBzdWJqZWN0Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCh2YWx1ZS5jaGlsZE5vZGVzLCBmdW5jdGlvbiAoY2hpbGROb2RlKSB7XG4gICAgICAgIHJldHVybiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMoY2hpbGROb2RlLCBpc0h0bWwpO1xuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTURvY3VtZW50RnJhZ21lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPG9iamVjdHxhcnJheT4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LmNoaWxkTm9kZXMsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuICAgICAgdmFyIGRvY3VtZW50RnJhZ21lbnQgPSBpc0h0bWwgPyBwYXJzZUh0bWwodmFsdWUsIHRydWUsIHRoaXMudGVzdERlc2NyaXB0aW9uKSA6IHBhcnNlWG1sKHZhbHVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbik7XG4gICAgICBpZiAoZG9jdW1lbnRGcmFnbWVudC5jaGlsZE5vZGVzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUxFbGVtZW50IHRvIHNhdGlzZnkgc3RyaW5nOiBPbmx5IGEgc2luZ2xlIG5vZGUgaXMgc3VwcG9ydGVkJyk7XG4gICAgICB9XG4gICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgb3V0cHV0LmNvZGUodmFsdWUsIGlzSHRtbCA/ICdodG1sJyA6ICd4bWwnKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgZG9jdW1lbnRGcmFnbWVudC5jaGlsZE5vZGVzWzBdKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJzxET01Eb2N1bWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8c3RyaW5nPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICB2YXIgdmFsdWVEb2N1bWVudCA9IGlzSHRtbCA/IHBhcnNlSHRtbCh2YWx1ZSwgZmFsc2UsIHRoaXMudGVzdERlc2NyaXB0aW9uKSA6IHBhcnNlWG1sKHZhbHVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbik7XG4gICAgICByZXR1cm4gZXhwZWN0KG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KHN1YmplY3QuY2hpbGROb2RlcyksICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHZhbHVlRG9jdW1lbnQuY2hpbGROb2RlcywgZnVuY3Rpb24gKGNoaWxkTm9kZSkge1xuICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgIH0pKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJzxET01Eb2N1bWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NRG9jdW1lbnQ+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgIHJldHVybiBleHBlY3QobWFrZUF0dGFjaGVkRE9NTm9kZUxpc3Qoc3ViamVjdC5jaGlsZE5vZGVzKSwgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodmFsdWUuY2hpbGROb2RlcywgZnVuY3Rpb24gKGNoaWxkTm9kZSkge1xuICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgIH0pKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJzxET01FbGVtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01FbGVtZW50PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlLCBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KSkpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTVRleHROb2RlPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICBleHBlY3QuZmFpbCgpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01FbGVtZW50PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICBleHBlY3QuZmFpbCgpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPG9iamVjdD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuICAgICAgdmFyIHVuc3VwcG9ydGVkT3B0aW9ucyA9IE9iamVjdC5rZXlzKHZhbHVlKS5maWx0ZXIoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4ga2V5ICE9PSAnYXR0cmlidXRlcycgJiYga2V5ICE9PSAnbmFtZScgJiYga2V5ICE9PSAnY2hpbGRyZW4nICYmIGtleSAhPT0gJ29ubHlBdHRyaWJ1dGVzJyAmJiBrZXkgIT09ICd0ZXh0Q29udGVudCc7XG4gICAgICB9KTtcbiAgICAgIGlmICh1bnN1cHBvcnRlZE9wdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG9wdGlvbicgKyAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnKSArICc6ICcgKyB1bnN1cHBvcnRlZE9wdGlvbnMuam9pbignLCAnKSk7XG4gICAgICB9XG5cbiAgICAgIHZhciBwcm9taXNlQnlLZXkgPSB7XG4gICAgICAgIG5hbWU6IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLm5hbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoaXNIdG1sID8gc3ViamVjdC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIDogc3ViamVjdC5ub2RlTmFtZSwgJ3RvIHNhdGlzZnknLCB2YWx1ZS5uYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBjaGlsZHJlbjogZXhwZWN0LnByb21pc2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUuY2hpbGRyZW4gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlLnRleHRDb250ZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBjaGlsZHJlbiBhbmQgdGV4dENvbnRlbnQgcHJvcGVydGllcyBhcmUgbm90IHN1cHBvcnRlZCB0b2dldGhlcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KHN1YmplY3QuY2hpbGROb2Rlcywgc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlKSwgJ3RvIHNhdGlzZnknLCB2YWx1ZS5jaGlsZHJlbik7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUudGV4dENvbnRlbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3Qoc3ViamVjdC50ZXh0Q29udGVudCwgJ3RvIHNhdGlzZnknLCB2YWx1ZS50ZXh0Q29udGVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgYXR0cmlidXRlczoge31cbiAgICAgIH07XG5cbiAgICAgIHZhciBvbmx5QXR0cmlidXRlcyA9IHZhbHVlICYmIHZhbHVlLm9ubHlBdHRyaWJ1dGVzIHx8IGV4cGVjdC5mbGFncy5leGhhdXN0aXZlbHk7XG4gICAgICB2YXIgYXR0cnMgPSBnZXRBdHRyaWJ1dGVzKHN1YmplY3QpO1xuICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlcyA9IHZhbHVlICYmIHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcyA9IFtdO1xuXG4gICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gW2V4cGVjdGVkQXR0cmlidXRlc107XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUgPSB7fTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID0gdHJ1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZEF0dHJpYnV0ZXMgJiYgdHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lID0gZXhwZWN0ZWRBdHRyaWJ1dGVzO1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLnB1c2goYXR0cmlidXRlTmFtZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgIHZhciBhdHRyaWJ1dGVWYWx1ZSA9IHN1YmplY3QuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID0gZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnICYmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gJ3N0cmluZycgfHwgQXJyYXkuaXNBcnJheShleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKSkpIHtcbiAgICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkQ2xhc3NlcyA9IGV4cGVjdGVkQXR0cmlidXRlVmFsdWU7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRDbGFzc2VzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGFjdHVhbENsYXNzZXMuc29ydCgpLCAndG8gZXF1YWwnLCBleHBlY3RlZENsYXNzZXMuc29ydCgpKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QuYXBwbHkodG9wTGV2ZWxFeHBlY3QsIFthY3R1YWxDbGFzc2VzLCAndG8gY29udGFpbiddLmNvbmNhdChleHBlY3RlZENsYXNzZXMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgIHZhciBleHBlY3RlZFN0eWxlT2JqO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9iaiA9IHN0eWxlU3RyaW5nVG9PYmplY3QoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9iaiA9IGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGU7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAob25seUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYXR0cnMuc3R5bGUsICd0byBleGhhdXN0aXZlbHkgc2F0aXNmeScsIGV4cGVjdGVkU3R5bGVPYmopO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChhdHRycy5zdHlsZSwgJ3RvIHNhdGlzZnknLCBleHBlY3RlZFN0eWxlT2JqKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgIHRvcExldmVsRXhwZWN0KHN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpLCAndG8gYmUgdHJ1ZScpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgdG9wTGV2ZWxFeHBlY3Qoc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksICd0byBiZSBmYWxzZScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGF0dHJpYnV0ZVZhbHVlLCAndG8gc2F0aXNmeScsIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBwcm9taXNlQnlLZXkuYXR0cmlidXRlUHJlc2VuY2UgPSBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZCA9IFtdO1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBleHBlY3QoYXR0cnMsICdub3QgdG8gaGF2ZSBrZXknLCBhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5wdXNoKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICBleHBlY3QoYXR0cnMsICd0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgZXhwZWN0KE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCksICd0byBlcXVhbCcsIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5zb3J0KCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHBlY3QucHJvbWlzZS5hbGwocHJvbWlzZUJ5S2V5KS5jYXVnaHQoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZXhwZWN0LnByb21pc2Uuc2V0dGxlKHByb21pc2VCeUtleSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoe1xuICAgICAgICAgICAgZGlmZjogZnVuY3Rpb24gKG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgb3V0cHV0ID0gdGhpcztcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc8JylcbiAgICAgICAgICAgICAgICAgIC5wcmlzbVRhZyhpc0h0bWwgPyBzdWJqZWN0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBzdWJqZWN0Lm5vZGVOYW1lKTtcbiAgICAgICAgICAgICAgICB2YXIgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAocHJvbWlzZUJ5S2V5Lm5hbWUuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbmFtZUVycm9yID0gcHJvbWlzZUJ5S2V5Lm5hbWUucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgLmVycm9yKChuYW1lRXJyb3IgJiYgbmFtZUVycm9yLmdldExhYmVsKCkpIHx8ICdzaG91bGQgc2F0aXNmeScpXG4gICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKGluc3BlY3QodmFsdWUubmFtZSkpO1xuICAgICAgICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgIG91dHB1dC5zcChjYW5Db250aW51ZUxpbmUgPyAxIDogMiArIHN1YmplY3Qubm9kZU5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihvdXRwdXQsIGF0dHJpYnV0ZU5hbWUsIGF0dHJzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgICAgICAgaWYgKChwcm9taXNlICYmIHByb21pc2UuaXNGdWxmaWxsZWQoKSkgfHwgKCFwcm9taXNlICYmICghb25seUF0dHJpYnV0ZXMgfHwgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpICE9PSAtMSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb21pc2UgJiYgdHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKHByb21pc2UucmVhc29uKCkuZ2V0RXJyb3JNZXNzYWdlKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9ubHlBdHRyaWJ1dGVzID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ3Nob3VsZCBiZSByZW1vdmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAubmwoKTtcbiAgICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIXN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghcHJvbWlzZSB8fCBwcm9taXNlLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBwcm9taXNlICYmIHByb21pc2UucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnNwKDIgKyBzdWJqZWN0Lm5vZGVOYW1lLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVycm9yKCdtaXNzaW5nJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcmlzbUF0dHJOYW1lKGF0dHJpYnV0ZU5hbWUsICdodG1sJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoKGVyciAmJiBlcnIuZ2V0TGFiZWwoKSkgfHwgJ3Nob3VsZCBzYXRpc2Z5JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChpbnNwZWN0KGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG91dHB1dC5wcmlzbVB1bmN0dWF0aW9uKCc+Jyk7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuRXJyb3IgPSBwcm9taXNlQnlLZXkuY2hpbGRyZW4uaXNSZWplY3RlZCgpICYmIHByb21pc2VCeUtleS5jaGlsZHJlbi5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuRGlmZiA9IGNoaWxkcmVuRXJyb3IuZ2V0RGlmZihvdXRwdXQpO1xuICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuRGlmZiAmJiBjaGlsZHJlbkRpZmYuaW5saW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmwoKS5pbmRlbnRMaW5lcygpLmkoKS5ibG9jayhjaGlsZHJlbkRpZmYuZGlmZikubmwoKS5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgICAgICAgICAgICAuaSgpLmJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IHN1YmplY3QuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKS5ubCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGNoaWxkcmVuRXJyb3IuZ2V0RXJyb3JNZXNzYWdlKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5ubCgpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBzdWJqZWN0LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGluc3BlY3Qoc3ViamVjdC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhzdWJqZWN0KSwgJ2h0bWwnKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRpZmY6IG91dHB1dFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIFtvbmx5XSBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcykgPHN0cmluZys+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIFtvbmx5XSBoYXZlIGF0dHJpYnV0ZXMnLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJzxET01FbGVtZW50PiB0byBbb25seV0gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpIDxhcnJheXxvYmplY3Q+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIHNhdGlzZnknLCB7IGF0dHJpYnV0ZXM6IHZhbHVlLCBvbmx5QXR0cmlidXRlczogZXhwZWN0LmZsYWdzLm9ubHkgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gaGF2ZSBubyAoY2hpbGR8Y2hpbGRyZW4pJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgcmV0dXJuIGV4cGVjdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdWJqZWN0LmNoaWxkTm9kZXMpLCAndG8gYmUgYW4gZW1wdHkgYXJyYXknKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJzxET01FbGVtZW50PiB0byBoYXZlIChjaGlsZHxjaGlsZHJlbiknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0KSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QuY2hpbGROb2RlcywgJ25vdCB0byBiZSBlbXB0eScpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIGhhdmUgKGNoaWxkfGNoaWxkcmVuKSA8c3RyaW5nPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHF1ZXJ5KSB7XG4gICAgICBleHBlY3QuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICBleHBlY3Qoc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KSwgJ25vdCB0byBiZSBlbXB0eScpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIGhhdmUgdGV4dCA8YW55PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QudGV4dENvbnRlbnQsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTURvY3VtZW50fERPTUVsZW1lbnR8RE9NRG9jdW1lbnRGcmFnbWVudD4gW3doZW5dIHF1ZXJpZWQgZm9yIFtmaXJzdF0gPHN0cmluZz4gPGFzc2VydGlvbj8+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgcXVlcnkpIHtcbiAgICAgIHZhciBxdWVyeVJlc3VsdDtcblxuICAgICAgZXhwZWN0LmFyZ3NPdXRwdXRbMF0gPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuZ3JlZW4ocXVlcnkpO1xuICAgICAgfTtcblxuICAgICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuXG4gICAgICBpZiAoZXhwZWN0LmZsYWdzLmZpcnN0KSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHF1ZXJ5KTtcbiAgICAgICAgaWYgKCFxdWVyeVJlc3VsdCkge1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyhxdWVyeSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KTtcbiAgICAgICAgaWYgKHF1ZXJ5UmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyhxdWVyeSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBleHBlY3Quc2hpZnQocXVlcnlSZXN1bHQpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTURvY3VtZW50fERPTUVsZW1lbnR8RE9NRG9jdW1lbnRGcmFnbWVudD4gdG8gY29udGFpbiBbbm9dIGVsZW1lbnRzIG1hdGNoaW5nIDxzdHJpbmc+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgcXVlcnkpIHtcbiAgICAgIGlmIChleHBlY3QuZmxhZ3Mubm8pIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpLCAndG8gc2F0aXNmeScsIFtdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KSwgJ25vdCB0byBzYXRpc2Z5JywgW10pO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPERPTURvY3VtZW50fERPTUVsZW1lbnR8RE9NRG9jdW1lbnRGcmFnbWVudD4gW25vdF0gdG8gbWF0Y2ggPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChtYXRjaGVzU2VsZWN0b3Ioc3ViamVjdCwgcXVlcnkpLCAndG8gYmUnLCAoZXhwZWN0LmZsYWdzLm5vdCA/IGZhbHNlIDogdHJ1ZSkpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPHN0cmluZz4gW3doZW5dIHBhcnNlZCBhcyAoaHRtbHxIVE1MKSBbZnJhZ21lbnRdIDxhc3NlcnRpb24/PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QpIHtcbiAgICAgIGV4cGVjdC5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgIHJldHVybiBleHBlY3Quc2hpZnQocGFyc2VIdG1sKHN1YmplY3QsIGV4cGVjdC5mbGFncy5mcmFnbWVudCwgZXhwZWN0LnRlc3REZXNjcmlwdGlvbikpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignPHN0cmluZz4gW3doZW5dIHBhcnNlZCBhcyAoeG1sfFhNTCkgPGFzc2VydGlvbj8+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgcmV0dXJuIGV4cGVjdC5zaGlmdChwYXJzZVhtbChzdWJqZWN0LCBleHBlY3QudGVzdERlc2NyaXB0aW9uKSk7XG4gICAgfSk7XG4gIH1cbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbG0sIHNlbGVjdG9yKSB7XG4gIHZhciBtYXRjaEZ1bnRpb24gPSBlbG0ubWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxtLm1vek1hdGNoZXNTZWxlY3RvciB8fFxuICAgIGVsbS5tc01hdGNoZXNTZWxlY3RvciB8fFxuICAgIGVsbS5vTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxtLndlYmtpdE1hdGNoZXNTZWxlY3RvciB8fFxuICAgIGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICAgICAgdmFyIG5vZGUgPSB0aGlzO1xuICAgICAgdmFyIG5vZGVzID0gKG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgIHZhciBpID0gMDtcblxuICAgICAgd2hpbGUgKG5vZGVzW2ldICYmIG5vZGVzW2ldICE9PSBub2RlKSB7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuICEhbm9kZXNbaV07XG4gICAgfTtcblxuICByZXR1cm4gbWF0Y2hGdW50aW9uLmNhbGwoZWxtLCBzZWxlY3Rvcik7XG59O1xuIiwiXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG52YXIgc2VsZiA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB7fTtcblxuLyoqXG4gKiBQcmlzbTogTGlnaHR3ZWlnaHQsIHJvYnVzdCwgZWxlZ2FudCBzeW50YXggaGlnaGxpZ2h0aW5nXG4gKiBNSVQgbGljZW5zZSBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocC9cbiAqIEBhdXRob3IgTGVhIFZlcm91IGh0dHA6Ly9sZWEudmVyb3UubWVcbiAqL1xuXG52YXIgUHJpc20gPSAoZnVuY3Rpb24oKXtcblxuLy8gUHJpdmF0ZSBoZWxwZXIgdmFyc1xudmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oPyFcXCopKFxcdyspXFxiL2k7XG5cbnZhciBfID0gc2VsZi5QcmlzbSA9IHtcblx0dXRpbDoge1xuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7IFxuXHRcdFx0cmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5tYXRjaCgvXFxbb2JqZWN0IChcXHcrKVxcXS8pWzFdO1xuXHRcdH0sXG5cdFx0XG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcblxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XG5cdFx0XHRcdFx0dmFyIGNsb25lID0ge307XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIG8pIHtcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmVba2V5XSA9IF8udXRpbC5jbG9uZShvW2tleV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRyZXR1cm4gY2xvbmU7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHRyZXR1cm4gby5zbGljZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gbztcblx0XHR9XG5cdH0sXG5cdFxuXHRsYW5ndWFnZXM6IHtcblx0XHRleHRlbmQ6IGZ1bmN0aW9uIChpZCwgcmVkZWYpIHtcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XG5cdFx0XHRcblx0XHRcdGZvciAodmFyIGtleSBpbiByZWRlZikge1xuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gbGFuZztcblx0XHR9LFxuXHRcdFxuXHRcdC8vIEluc2VydCBhIHRva2VuIGJlZm9yZSBhbm90aGVyIHRva2VuIGluIGEgbGFuZ3VhZ2UgbGl0ZXJhbFxuXHRcdGluc2VydEJlZm9yZTogZnVuY3Rpb24gKGluc2lkZSwgYmVmb3JlLCBpbnNlcnQsIHJvb3QpIHtcblx0XHRcdHJvb3QgPSByb290IHx8IF8ubGFuZ3VhZ2VzO1xuXHRcdFx0dmFyIGdyYW1tYXIgPSByb290W2luc2lkZV07XG5cdFx0XHR2YXIgcmV0ID0ge307XG5cdFx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0XG5cdFx0XHRcdGlmIChncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cmV0W3Rva2VuXSA9IGdyYW1tYXJbdG9rZW5dO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiByb290W2luc2lkZV0gPSByZXQ7XG5cdFx0fSxcblx0XHRcblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrKSB7XG5cdFx0XHRmb3IgKHZhciBpIGluIG8pIHtcblx0XHRcdFx0Y2FsbGJhY2suY2FsbChvLCBpLCBvW2ldKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ09iamVjdCcpIHtcblx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodEFsbDogZnVuY3Rpb24oYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0dmFyIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnY29kZVtjbGFzcyo9XCJsYW5ndWFnZS1cIl0sIFtjbGFzcyo9XCJsYW5ndWFnZS1cIl0gY29kZSwgY29kZVtjbGFzcyo9XCJsYW5nLVwiXSwgW2NsYXNzKj1cImxhbmctXCJdIGNvZGUnKTtcblxuXHRcdGZvciAodmFyIGk9MCwgZWxlbWVudDsgZWxlbWVudCA9IGVsZW1lbnRzW2krK107KSB7XG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGNhbGxiYWNrKTtcblx0XHR9XG5cdH0sXG5cdFx0XG5cdGhpZ2hsaWdodEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdC8vIEZpbmQgbGFuZ3VhZ2Vcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XG5cdFx0XG5cdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XG5cdFx0XHRwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcblx0XHR9XG5cdFx0XG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV07XG5cdFx0XHRncmFtbWFyID0gXy5sYW5ndWFnZXNbbGFuZ3VhZ2VdO1xuXHRcdH1cblxuXHRcdGlmICghZ3JhbW1hcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIGVsZW1lbnQsIGlmIG5vdCBwcmVzZW50XG5cdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5yZXBsYWNlKGxhbmcsICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykgKyAnIGxhbmd1YWdlLScgKyBsYW5ndWFnZTtcblx0XHRcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcblx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cdFx0XG5cdFx0aWYgKC9wcmUvaS50ZXN0KHBhcmVudC5ub2RlTmFtZSkpIHtcblx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlOyBcblx0XHR9XG5cblx0XHR2YXIgY29kZSA9IGVsZW1lbnQudGV4dENvbnRlbnQ7XG5cdFx0XG5cdFx0aWYoIWNvZGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29kZSA9IGNvZGUucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xuXHRcdFxuXHRcdHZhciBlbnYgPSB7XG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxuXHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdFx0Z3JhbW1hcjogZ3JhbW1hcixcblx0XHRcdGNvZGU6IGNvZGVcblx0XHR9O1xuXHRcdFxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcblx0XHRpZiAoYXN5bmMgJiYgc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1x0XG5cdFx0XHRcblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IFRva2VuLnN0cmluZ2lmeShKU09OLnBhcnNlKGV2dC5kYXRhKSwgbGFuZ3VhZ2UpO1xuXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcblxuXHRcdFx0XHRlbnYuZWxlbWVudC5pbm5lckhUTUwgPSBlbnYuaGlnaGxpZ2h0ZWRDb2RlO1xuXHRcdFx0XHRcblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0fTtcblx0XHRcdFxuXHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcblx0XHRcdFx0Y29kZTogZW52LmNvZGVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpXG5cblx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcblxuXHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblx0XHRcdFxuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbGVtZW50KTtcblx0XHRcdFxuXHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0fVxuXHR9LFxuXHRcblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udG9rZW5pemUodGV4dCwgZ3JhbW1hciksIGxhbmd1YWdlKTtcblx0fSxcblx0XG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xuXHRcdHZhciBUb2tlbiA9IF8uVG9rZW47XG5cdFx0XG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcblx0XHRcblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcblx0XHRcblx0XHRpZiAocmVzdCkge1xuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gcmVzdCkge1xuXHRcdFx0XHRncmFtbWFyW3Rva2VuXSA9IHJlc3RbdG9rZW5dO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRkZWxldGUgZ3JhbW1hci5yZXN0O1xuXHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcblx0XHR0b2tlbmxvb3A6IGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblx0XHRcdGlmKCFncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSB8fCAhZ3JhbW1hclt0b2tlbl0pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciBwYXR0ZXJuID0gZ3JhbW1hclt0b2tlbl0sIFxuXHRcdFx0XHRpbnNpZGUgPSBwYXR0ZXJuLmluc2lkZSxcblx0XHRcdFx0bG9va2JlaGluZCA9ICEhcGF0dGVybi5sb29rYmVoaW5kLFxuXHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gMDtcblx0XHRcdFxuXHRcdFx0cGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybiB8fCBwYXR0ZXJuO1xuXHRcdFx0XG5cdFx0XHRmb3IgKHZhciBpPTA7IGk8c3RyYXJyLmxlbmd0aDsgaSsrKSB7IC8vIERvbuKAmXQgY2FjaGUgbGVuZ3RoIGFzIGl0IGNoYW5nZXMgZHVyaW5nIHRoZSBsb29wXG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgc3RyID0gc3RyYXJyW2ldO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdC8vIFNvbWV0aGluZyB3ZW50IHRlcnJpYmx5IHdyb25nLCBBQk9SVCwgQUJPUlQhXG5cdFx0XHRcdFx0YnJlYWsgdG9rZW5sb29wO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoc3RyIGluc3RhbmNlb2YgVG9rZW4pIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSAwO1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIG1hdGNoID0gcGF0dGVybi5leGVjKHN0cik7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0ubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggLSAxICsgbG9va2JlaGluZExlbmd0aCxcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcblx0XHRcdFx0XHQgICAgbGVuID0gbWF0Y2gubGVuZ3RoLFxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBsZW4sXG5cdFx0XHRcdFx0XHRiZWZvcmUgPSBzdHIuc2xpY2UoMCwgZnJvbSArIDEpLFxuXHRcdFx0XHRcdFx0YWZ0ZXIgPSBzdHIuc2xpY2UodG8gKyAxKTsgXG5cblx0XHRcdFx0XHR2YXIgYXJncyA9IFtpLCAxXTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRpZiAoYmVmb3JlKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYmVmb3JlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRhcmdzLnB1c2god3JhcHBlZCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYgKGFmdGVyKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHN0cmFyciwgYXJncyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyYXJyO1xuXHR9LFxuXHRcblx0aG9va3M6IHtcblx0XHRhbGw6IHt9LFxuXHRcdFxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgaG9va3MgPSBfLmhvb2tzLmFsbDtcblx0XHRcdFxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcblx0XHRcdFxuXHRcdFx0aG9va3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdFx0fSxcblx0XHRcblx0XHRydW46IGZ1bmN0aW9uIChuYW1lLCBlbnYpIHtcblx0XHRcdHZhciBjYWxsYmFja3MgPSBfLmhvb2tzLmFsbFtuYW1lXTtcblx0XHRcdFxuXHRcdFx0aWYgKCFjYWxsYmFja3MgfHwgIWNhbGxiYWNrcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRmb3IgKHZhciBpPTAsIGNhbGxiYWNrOyBjYWxsYmFjayA9IGNhbGxiYWNrc1tpKytdOykge1xuXHRcdFx0XHRjYWxsYmFjayhlbnYpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufTtcblxudmFyIFRva2VuID0gXy5Ub2tlbiA9IGZ1bmN0aW9uKHR5cGUsIGNvbnRlbnQpIHtcblx0dGhpcy50eXBlID0gdHlwZTtcblx0dGhpcy5jb250ZW50ID0gY29udGVudDtcbn07XG5cblRva2VuLnN0cmluZ2lmeSA9IGZ1bmN0aW9uKG8sIGxhbmd1YWdlLCBwYXJlbnQpIHtcblx0aWYgKHR5cGVvZiBvID09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIG87XG5cdH1cblxuXHRpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pID09ICdbb2JqZWN0IEFycmF5XScpIHtcblx0XHRyZXR1cm4gby5tYXAoZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShlbGVtZW50LCBsYW5ndWFnZSwgbyk7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblx0XG5cdHZhciBlbnYgPSB7XG5cdFx0dHlwZTogby50eXBlLFxuXHRcdGNvbnRlbnQ6IFRva2VuLnN0cmluZ2lmeShvLmNvbnRlbnQsIGxhbmd1YWdlLCBwYXJlbnQpLFxuXHRcdHRhZzogJ3NwYW4nLFxuXHRcdGNsYXNzZXM6IFsndG9rZW4nLCBvLnR5cGVdLFxuXHRcdGF0dHJpYnV0ZXM6IHt9LFxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRwYXJlbnQ6IHBhcmVudFxuXHR9O1xuXHRcblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWydzcGVsbGNoZWNrJ10gPSAndHJ1ZSc7XG5cdH1cblx0XG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcblx0XG5cdHZhciBhdHRyaWJ1dGVzID0gJyc7XG5cdFxuXHRmb3IgKHZhciBuYW1lIGluIGVudi5hdHRyaWJ1dGVzKSB7XG5cdFx0YXR0cmlidXRlcyArPSBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpICsgJ1wiJztcblx0fVxuXHRcblx0cmV0dXJuICc8JyArIGVudi50YWcgKyAnIGNsYXNzPVwiJyArIGVudi5jbGFzc2VzLmpvaW4oJyAnKSArICdcIiAnICsgYXR0cmlidXRlcyArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XG5cdFxufTtcblxuaWYgKCFzZWxmLmRvY3VtZW50KSB7XG5cdGlmICghc2VsZi5hZGRFdmVudExpc3RlbmVyKSB7XG5cdFx0Ly8gaW4gTm9kZS5qc1xuXHRcdHJldHVybiBzZWxmLlByaXNtO1xuXHR9XG4gXHQvLyBJbiB3b3JrZXJcblx0c2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcblx0XHQgICAgbGFuZyA9IG1lc3NhZ2UubGFuZ3VhZ2UsXG5cdFx0ICAgIGNvZGUgPSBtZXNzYWdlLmNvZGU7XG5cdFx0XG5cdFx0c2VsZi5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShfLnRva2VuaXplKGNvZGUsIF8ubGFuZ3VhZ2VzW2xhbmddKSkpO1xuXHRcdHNlbGYuY2xvc2UoKTtcblx0fSwgZmFsc2UpO1xuXHRcblx0cmV0dXJuIHNlbGYuUHJpc207XG59XG5cbi8vIEdldCBjdXJyZW50IHNjcmlwdCBhbmQgaGlnaGxpZ2h0XG52YXIgc2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpO1xuXG5zY3JpcHQgPSBzY3JpcHRbc2NyaXB0Lmxlbmd0aCAtIDFdO1xuXG5pZiAoc2NyaXB0KSB7XG5cdF8uZmlsZW5hbWUgPSBzY3JpcHQuc3JjO1xuXHRcblx0aWYgKGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgXy5oaWdobGlnaHRBbGwpO1xuXHR9XG59XG5cbnJldHVybiBzZWxmLlByaXNtO1xuXG59KSgpO1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0bW9kdWxlLmV4cG9ydHMgPSBQcmlzbTtcbn1cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1tYXJrdXAuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cCA9IHtcblx0J2NvbW1lbnQnOiAvJmx0OyEtLVtcXHdcXFddKj8tLT4vZyxcblx0J3Byb2xvZyc6IC8mbHQ7XFw/Lis/XFw/Pi8sXG5cdCdkb2N0eXBlJzogLyZsdDshRE9DVFlQRS4rPz4vLFxuXHQnY2RhdGEnOiAvJmx0OyFcXFtDREFUQVxcW1tcXHdcXFddKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvJmx0O1xcLz9bXFx3Oi1dK1xccyooPzpcXHMrW1xcdzotXSsoPzo9KD86KFwifCcpKFxcXFw/W1xcd1xcV10pKj9cXDF8W15cXHMnXCI+PV0rKSk/XFxzKikqXFwvPz4vZ2ksXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQndGFnJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvXiZsdDtcXC8/W1xcdzotXSsvaSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogL14mbHQ7XFwvPy8sXG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW1xcdy1dKz86L1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J2F0dHItdmFsdWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC89KD86KCd8XCIpW1xcd1xcV10qPyhcXDEpfFteXFxzPl0rKS9naSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogLz18PnxcIi9nXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQncHVuY3R1YXRpb24nOiAvXFwvPz4vZyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXFx3Oi1dKy9nLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXFx3LV0rPzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mYW1wOyM/W1xcZGEtel17MSw4fTsvZ2lcbn07XG5cbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XG5QcmlzbS5ob29rcy5hZGQoJ3dyYXAnLCBmdW5jdGlvbihlbnYpIHtcblxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3RpdGxlJ10gPSBlbnYuY29udGVudC5yZXBsYWNlKC8mYW1wOy8sICcmJyk7XG5cdH1cbn0pO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdCdjb21tZW50JzogL1xcL1xcKltcXHdcXFddKj9cXCpcXC8vZyxcblx0J2F0cnVsZSc6IHtcblx0XHRwYXR0ZXJuOiAvQFtcXHctXSs/Lio/KDt8KD89XFxzKnspKS9naSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdwdW5jdHVhdGlvbic6IC9bOzpdL2dcblx0XHR9XG5cdH0sXG5cdCd1cmwnOiAvdXJsXFwoKFtcIiddPykuKj9cXDFcXCkvZ2ksXG5cdCdzZWxlY3Rvcic6IC9bXlxce1xcfVxcc11bXlxce1xcfTtdKig/PVxccypcXHspL2csXG5cdCdwcm9wZXJ0eSc6IC8oXFxifFxcQilbXFx3LV0rKD89XFxzKjopL2lnLFxuXHQnc3RyaW5nJzogLyhcInwnKShcXFxcPy4pKj9cXDEvZyxcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2dpLFxuXHQnaWdub3JlJzogLyYobHR8Z3R8YW1wKTsvZ2ksXG5cdCdwdW5jdHVhdGlvbic6IC9bXFx7XFx9OzpdL2dcbn07XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3N0eWxlJzoge1xuXHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc3R5bGVbXFx3XFxXXSo/KD58Jmd0OylbXFx3XFxXXSo/KCZsdDt8PClcXC9zdHlsZSg+fCZndDspL2lnLFxuXHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdCd0YWcnOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc3R5bGVbXFx3XFxXXSo/KD58Jmd0Oyl8KCZsdDt8PClcXC9zdHlsZSg+fCZndDspL2lnLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5jc3Ncblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufVxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNsaWtlLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jbGlrZSA9IHtcblx0J2NvbW1lbnQnOiB7XG5cdFx0cGF0dGVybjogLyhefFteXFxcXF0pKFxcL1xcKltcXHdcXFddKj9cXCpcXC98KF58W146XSlcXC9cXC8uKj8oXFxyP1xcbnwkKSkvZyxcblx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdH0sXG5cdCdzdHJpbmcnOiAvKFwifCcpKFxcXFw/LikqP1xcMS9nLFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKCg/Oig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbYS16MC05X1xcLlxcXFxdKy9pZyxcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0cHVuY3R1YXRpb246IC8oXFwufFxcXFwpL1xuXHRcdH1cblx0fSxcblx0J2tleXdvcmQnOiAvXFxiKGlmfGVsc2V8d2hpbGV8ZG98Zm9yfHJldHVybnxpbnxpbnN0YW5jZW9mfGZ1bmN0aW9ufG5ld3x0cnl8dGhyb3d8Y2F0Y2h8ZmluYWxseXxudWxsfGJyZWFrfGNvbnRpbnVlKVxcYi9nLFxuXHQnYm9vbGVhbic6IC9cXGIodHJ1ZXxmYWxzZSlcXGIvZyxcblx0J2Z1bmN0aW9uJzoge1xuXHRcdHBhdHRlcm46IC9bYS16MC05X10rXFwoL2lnLFxuXHRcdGluc2lkZToge1xuXHRcdFx0cHVuY3R1YXRpb246IC9cXCgvXG5cdFx0fVxuXHR9LFxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfFxcZCpcXC4/XFxkKyhbRWVdLT9cXGQrKT8pXFxiL2csXG5cdCdvcGVyYXRvcic6IC9bLStdezEsMn18IXwmbHQ7PT98Pj0/fD17MSwzfXwoJmFtcDspezEsMn18XFx8P1xcfHxcXD98XFwqfFxcL3xcXH58XFxefFxcJS9nLFxuXHQnaWdub3JlJzogLyYobHR8Z3R8YW1wKTsvZ2ksXG5cdCdwdW5jdHVhdGlvbic6IC9be31bXFxdOygpLC46XS9nXG59O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tamF2YXNjcmlwdC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCA9IFByaXNtLmxhbmd1YWdlcy5leHRlbmQoJ2NsaWtlJywge1xuXHQna2V5d29yZCc6IC9cXGIodmFyfGxldHxpZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxnZXR8c2V0fG5ld3x3aXRofHR5cGVvZnx0cnl8dGhyb3d8Y2F0Y2h8ZmluYWxseXxudWxsfGJyZWFrfGNvbnRpbnVlfHRoaXMpXFxiL2csXG5cdCdudW1iZXInOiAvXFxiLT8oMHhbXFxkQS1GYS1mXSt8XFxkKlxcLj9cXGQrKFtFZV0tP1xcZCspP3xOYU58LT9JbmZpbml0eSlcXGIvZ1xufSk7XG5cblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAna2V5d29yZCcsIHtcblx0J3JlZ2V4Jzoge1xuXHRcdHBhdHRlcm46IC8oXnxbXi9dKVxcLyg/IVxcLykoXFxbLis/XXxcXFxcLnxbXi9cXHJcXG5dKStcXC9bZ2ltXXswLDN9KD89XFxzKigkfFtcXHJcXG4sLjt9KV0pKS9nLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0fVxufSk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3NjcmlwdCc6IHtcblx0XHRcdHBhdHRlcm46IC8oJmx0O3w8KXNjcmlwdFtcXHdcXFddKj8oPnwmZ3Q7KVtcXHdcXFddKj8oJmx0O3w8KVxcL3NjcmlwdCg+fCZndDspL2lnLFxuXHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdCd0YWcnOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc2NyaXB0W1xcd1xcV10qPyg+fCZndDspfCgmbHQ7fDwpXFwvc2NyaXB0KD58Jmd0OykvaWcsXG5cdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZy5pbnNpZGVcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVzdDogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHRcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tZmlsZS1oaWdobGlnaHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuKGZ1bmN0aW9uKCl7XG5cbmlmICghc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xuXHRyZXR1cm47XG59XG5cbnZhciBFeHRlbnNpb25zID0ge1xuXHQnanMnOiAnamF2YXNjcmlwdCcsXG5cdCdodG1sJzogJ21hcmt1cCcsXG5cdCdzdmcnOiAnbWFya3VwJ1xufTtcblxuQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgncHJlW2RhdGEtc3JjXScpKS5mb3JFYWNoKGZ1bmN0aW9uKHByZSkge1xuXHR2YXIgc3JjID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcblx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCcnXSlbMV07XG5cdHZhciBsYW5ndWFnZSA9IEV4dGVuc2lvbnNbZXh0ZW5zaW9uXSB8fCBleHRlbnNpb247XG5cdFxuXHR2YXIgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKTtcblx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXHRcblx0cHJlLnRleHRDb250ZW50ID0gJyc7XG5cdFxuXHRjb2RlLnRleHRDb250ZW50ID0gJ0xvYWRpbmfigKYnO1xuXHRcblx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xuXHRcblx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcblx0eGhyLm9wZW4oJ0dFVCcsIHNyYywgdHJ1ZSk7XG5cblx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh4aHIucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcblx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9IHhoci5yZXNwb25zZVRleHQ7XG5cdFx0XHRcblx0XHRcdFx0UHJpc20uaGlnaGxpZ2h0RWxlbWVudChjb2RlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKHhoci5zdGF0dXMgPj0gNDAwKSB7XG5cdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblx0XG5cdHhoci5zZW5kKG51bGwpO1xufSk7XG5cbn0pKCk7IiwidmFyIHByaXNtID0gcmVxdWlyZSgnLi4vM3JkcGFydHkvcHJpc20nKSxcbiAgICBkZWZhdWx0VGhlbWUgPSB7XG4gICAgICAgIC8vIEFkYXB0ZWQgZnJvbSB0aGUgZGVmYXVsdCBQcmlzbSB0aGVtZTpcbiAgICAgICAgcHJpc21Db21tZW50OiAnIzcwODA5MCcsIC8vIHNsYXRlZ3JheVxuICAgICAgICBwcmlzbVByb2xvZzogJ3ByaXNtQ29tbWVudCcsXG4gICAgICAgIHByaXNtRG9jdHlwZTogJ3ByaXNtQ29tbWVudCcsXG4gICAgICAgIHByaXNtQ2RhdGE6ICdwcmlzbUNvbW1lbnQnLFxuXG4gICAgICAgIHByaXNtUHVuY3R1YXRpb246ICcjOTk5JyxcblxuICAgICAgICBwcmlzbVN5bWJvbDogJyM5MDUnLFxuICAgICAgICBwcmlzbVByb3BlcnR5OiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbVRhZzogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21Cb29sZWFuOiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbU51bWJlcjogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21Db25zdGFudDogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21EZWxldGVkOiAncHJpc21TeW1ib2wnLFxuXG4gICAgICAgIHByaXNtU3RyaW5nOiAnIzY5MCcsXG4gICAgICAgIHByaXNtU2VsZWN0b3I6ICdwcmlzbVN0cmluZycsXG4gICAgICAgIHByaXNtQXR0ck5hbWU6ICdwcmlzbVN0cmluZycsXG4gICAgICAgIHByaXNtQ2hhcjogJ3ByaXNtU3RyaW5nJyxcbiAgICAgICAgcHJpc21CdWlsdGluOiAncHJpc21TdHJpbmcnLFxuICAgICAgICBwcmlzbUluc2VydGVkOiAncHJpc21TdHJpbmcnLFxuXG4gICAgICAgIHByaXNtT3BlcmF0b3I6ICcjYTY3ZjU5JyxcbiAgICAgICAgcHJpc21WYXJpYWJsZTogJ3ByaXNtT3BlcmF0b3InLFxuICAgICAgICBwcmlzbUVudGl0eTogJ3ByaXNtT3BlcmF0b3InLFxuICAgICAgICBwcmlzbVVybDogJ3ByaXNtT3BlcmF0b3InLFxuICAgICAgICBwcmlzbUNzc1N0cmluZzogJ3ByaXNtT3BlcmF0b3InLFxuXG4gICAgICAgIHByaXNtS2V5d29yZDogJyMwN2EnLFxuICAgICAgICBwcmlzbUF0cnVsZTogJ3ByaXNtS2V5d29yZCcsXG4gICAgICAgIHByaXNtQXR0clZhbHVlOiAncHJpc21LZXl3b3JkJyxcblxuICAgICAgICBwcmlzbUZ1bmN0aW9uOiAnI0RENEE2OCcsXG5cbiAgICAgICAgcHJpc21SZWdleDogJyNlOTAnLFxuICAgICAgICBwcmlzbUltcG9ydGFudDogWycjZTkwJywgJ2JvbGQnXVxuICAgIH0sXG4gICAgbGFuZ3VhZ2VNYXBwaW5nID0ge1xuICAgICAgICAndGV4dC9odG1sJzogJ21hcmt1cCcsXG4gICAgICAgICdhcHBsaWNhdGlvbi94bWwnOiAnbWFya3VwJyxcbiAgICAgICAgJ3RleHQveG1sJzogJ21hcmt1cCcsXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ2phdmFzY3JpcHQnLFxuICAgICAgICAndGV4dC9qYXZhc2NyaXB0JzogJ2phdmFzY3JpcHQnLFxuICAgICAgICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCc6ICdqYXZhc2NyaXB0JyxcbiAgICAgICAgJ3RleHQvY3NzJzogJ2NzcycsXG4gICAgICAgIGh0bWw6ICdtYXJrdXAnLFxuICAgICAgICB4bWw6ICdtYXJrdXAnLFxuICAgICAgICBjOiAnY2xpa2UnLFxuICAgICAgICAnYysrJzogJ2NsaWtlJyxcbiAgICAgICAgJ2NwcCc6ICdjbGlrZScsXG4gICAgICAgICdjIyc6ICdjbGlrZScsXG4gICAgICAgIGphdmE6ICdjbGlrZSdcbiAgICB9O1xuXG5mdW5jdGlvbiB1cHBlckNhbWVsQ2FzZShzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyg/Ol58LSkoW2Etel0pL2csIGZ1bmN0aW9uICgkMCwgY2gpIHtcbiAgICAgICAgcmV0dXJuIGNoLnRvVXBwZXJDYXNlKCk7XG4gICAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIG5hbWU6ICdtYWdpY3Blbi1wcmlzbScsXG4gICAgdmVyc2lvbjogcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJykudmVyc2lvbixcbiAgICBpbnN0YWxsSW50bzogZnVuY3Rpb24gKG1hZ2ljUGVuKSB7XG4gICAgICAgIG1hZ2ljUGVuLmluc3RhbGxUaGVtZShkZWZhdWx0VGhlbWUpO1xuXG4gICAgICAgIG1hZ2ljUGVuLmFkZFN0eWxlKCdjb2RlJywgZnVuY3Rpb24gKHNvdXJjZVRleHQsIGxhbmd1YWdlKSB7XG4gICAgICAgICAgICBpZiAobGFuZ3VhZ2UgaW4gbGFuZ3VhZ2VNYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2UgPSBsYW5ndWFnZU1hcHBpbmdbbGFuZ3VhZ2VdO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgvXFwreG1sXFxiLy50ZXN0KGxhbmd1YWdlKSkge1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlID0gJ21hcmt1cCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShsYW5ndWFnZSBpbiBwcmlzbS5sYW5ndWFnZXMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudGV4dChzb3VyY2VUZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc291cmNlVGV4dCA9IHNvdXJjZVRleHQucmVwbGFjZSgvPC9nLCAnJmx0OycpOyAvLyBQcmlzbWlzbVxuXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgY2FwaXRhbGl6ZWRMYW5ndWFnZSA9IHVwcGVyQ2FtZWxDYXNlKGxhbmd1YWdlKTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gcHJpbnRUb2tlbnModG9rZW4sIHBhcmVudFN0eWxlKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodG9rZW4pKSB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuLmZvckVhY2goZnVuY3Rpb24gKHN1YlRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmludFRva2VucyhzdWJUb2tlbiwgcGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlID0gdXBwZXJDYW1lbENhc2UocGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHRva2VuLnJlcGxhY2UoLyZsdDsvZywgJzwnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0odG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoYXRbJ3ByaXNtJyArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdFsncHJpc20nICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKHRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudGV4dCh0b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcmludFRva2Vucyh0b2tlbi5jb250ZW50LCB0b2tlbi50eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmludFRva2VucyhwcmlzbS50b2tlbml6ZShzb3VyY2VUZXh0LCBwcmlzbS5sYW5ndWFnZXNbbGFuZ3VhZ2VdKSwgJ3RleHQnKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJuYW1lXCI6IFwibWFnaWNwZW4tcHJpc21cIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMi4yLjFcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkFkZCBzeW50YXggaGlnaGxpZ2h0aW5nIHN1cHBvcnQgdG8gbWFnaWNwZW4gdmlhIHByaXNtLmpzXCIsXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJnaXQraHR0cHM6Ly9naXRodWIuY29tL3VuZXhwZWN0ZWRqcy9tYWdpY3Blbi1wcmlzbS5naXRcIlxuICB9LFxuICBcIm1haW5cIjogXCJsaWIvbWFnaWNQZW5QcmlzbS5qc1wiLFxuICBcImF1dGhvclwiOiB7XG4gICAgXCJuYW1lXCI6IFwiQW5kcmVhcyBMaW5kIFBldGVyc2VuXCIsXG4gICAgXCJlbWFpbFwiOiBcImFuZHJlYXNAb25lLmNvbVwiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCI4LjEuMVwiLFxuICAgIFwiYnVuZGxlLWNvbGxhcHNlclwiOiBcIjEuMS4xXCIsXG4gICAgXCJqc2hpbnRcIjogXCIyLjcuMFwiLFxuICAgIFwibWFnaWNwZW5cIjogXCI0LjMuMVwiLFxuICAgIFwibW9jaGFcIjogXCIxLjIxLjRcIixcbiAgICBcInVuZXhwZWN0ZWRcIjogXCI1LjguMFwiXG4gIH0sXG4gIFwiZmlsZXNcIjogW1xuICAgIFwibGliXCIsXG4gICAgXCJtYWdpY1BlblByaXNtLm1pbi5qc1wiLFxuICAgIFwiM3JkcGFydHkvcHJpc20uanNcIlxuICBdLFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwidGVzdFwiOiBcIm1vY2hhXCIsXG4gICAgXCJsaW50XCI6IFwianNoaW50IC5cIixcbiAgICBcInRyYXZpc1wiOiBcIm5wbSBydW4gbGludCAmJiBucG0gdGVzdFwiLFxuICAgIFwicHJlcHVibGlzaFwiOiBcImJyb3dzZXJpZnkgLXAgYnVuZGxlLWNvbGxhcHNlci9wbHVnaW4gLWUgbGliL21hZ2ljUGVuUHJpc20gLXMgbWFnaWNQZW5QcmlzbSA+IG1hZ2ljUGVuUHJpc20ubWluLmpzXCJcbiAgfSxcbiAgXCJnaXRIZWFkXCI6IFwiODhkYTkzN2MyMGRhZjFhMTFkZDQyMDZlNWRjZmUwMzYxMDlmNWNlOVwiLFxuICBcImJ1Z3NcIjoge1xuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3VuZXhwZWN0ZWRqcy9tYWdpY3Blbi1wcmlzbS9pc3N1ZXNcIlxuICB9LFxuICBcImhvbWVwYWdlXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3VuZXhwZWN0ZWRqcy9tYWdpY3Blbi1wcmlzbSNyZWFkbWVcIixcbiAgXCJfaWRcIjogXCJtYWdpY3Blbi1wcmlzbUAyLjIuMVwiLFxuICBcIl9zaGFzdW1cIjogXCI5MGEyMjQ5NjhiNTEyZjc2OTUwNmRjNjUxODg5OTU4MjE2ODFiNjMxXCIsXG4gIFwiX2Zyb21cIjogXCJtYWdpY3Blbi1wcmlzbUA+PTIuMi4xIDwzLjAuMFwiLFxuICBcIl9ucG1WZXJzaW9uXCI6IFwiMi4xNC4yXCIsXG4gIFwiX25vZGVWZXJzaW9uXCI6IFwiMC4xMC40MFwiLFxuICBcIl9ucG1Vc2VyXCI6IHtcbiAgICBcIm5hbWVcIjogXCJwYXBhbmRyZW91XCIsXG4gICAgXCJlbWFpbFwiOiBcImFuZHJlYXNAb25lLmNvbVwiXG4gIH0sXG4gIFwiZGlzdFwiOiB7XG4gICAgXCJzaGFzdW1cIjogXCI5MGEyMjQ5NjhiNTEyZjc2OTUwNmRjNjUxODg5OTU4MjE2ODFiNjMxXCIsXG4gICAgXCJ0YXJiYWxsXCI6IFwiaHR0cDovL3JlZ2lzdHJ5Lm5wbWpzLm9yZy9tYWdpY3Blbi1wcmlzbS8tL21hZ2ljcGVuLXByaXNtLTIuMi4xLnRnelwiXG4gIH0sXG4gIFwibWFpbnRhaW5lcnNcIjogW1xuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcInBhcGFuZHJlb3VcIixcbiAgICAgIFwiZW1haWxcIjogXCJhbmRyZWFzQG9uZS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwic3VuZXNpbW9uc2VuXCIsXG4gICAgICBcImVtYWlsXCI6IFwic3VuZUB3ZS1rbm93aG93LmRrXCJcbiAgICB9XG4gIF0sXG4gIFwiZGlyZWN0b3JpZXNcIjoge30sXG4gIFwiX3Jlc29sdmVkXCI6IFwiaHR0cHM6Ly9yZWdpc3RyeS5ucG1qcy5vcmcvbWFnaWNwZW4tcHJpc20vLS9tYWdpY3Blbi1wcmlzbS0yLjIuMS50Z3pcIixcbiAgXCJyZWFkbWVcIjogXCJFUlJPUjogTm8gUkVBRE1FIGRhdGEgZm91bmQhXCJcbn1cbiJdfQ==
