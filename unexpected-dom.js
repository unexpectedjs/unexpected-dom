(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/*global DOMParser*/
var matchesSelector = require('./matchesSelector');

function getJSDOM() {
  try {
    return require('' + 'jsdom');
  } catch (err) {
    throw new Error('unexpected-dom: Running outside a browser (or in a browser without DOMParser), but could not find the `jsdom` module. Please npm install jsdom to make this work.');
  }
}

function getHtmlDocument(str) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(str, 'text/html');
  } else if (typeof document !== 'undefined' && document.implementation && document.implementation.createHTMLDocument) {
    var htmlDocument = document.implementation.createHTMLDocument('');
    htmlDocument.open();
    htmlDocument.write(str);
    htmlDocument.close();
    return htmlDocument;
  } else {
    var jsdom = getJSDOM();

    return jsdom.JSDOM ? new jsdom.JSDOM(str).window.document : jsdom.jsdom(str);
  }
}

function parseHtml(str, isFragment) {
  if (isFragment) {
    str = '<html><head></head><body>' + str + '</body></html>';
  }
  var htmlDocument = getHtmlDocument(str);

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

function parseXml(str) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(str, 'text/xml');
  } else {
    var jsdom = getJSDOM();

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

function validateStyles(expect, str) {
  var invalidStyles = str.split(';').filter(function (part) {
    return !/^\s*(\w|-)+\s*:\s*(#(?:[0-9a-fA-F]{3}){1,2}|[^#]+)\s*$|^$/.test(part);
  });

  if (invalidStyles.length > 0) {
    expect.errorMode = 'nested';
    expect.fail('Expectation contains invalid styles: {0}', invalidStyles.join(';'));
  }
}

function styleStringToObject(str) {
  var styles = {};

  str.split(';').forEach(function (rule) {
    var tuple = rule.split(':').map(function (part) {
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
  var ownerDocument = node.nodeType === 9 && node.documentElement && node.implementation ? node : node.ownerDocument;

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
      result[attrs[i].name] = isHtml && isBooleanAttribute(attrs[i].name) ? true : attrs[i].value || '';
    }
  }

  return result;
}

function entitify(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function isVoidElement(elementName) {
  return (/(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)/i.test(elementName)
  );
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
    output.prismPunctuation('="').prismAttrValue(entitify(value)).prismPunctuation('"');
  }
}

function stringifyAttribute(attributeName, value) {
  if (isBooleanAttribute(attributeName) || isEnumeratedAttribute(attributeName)) {
    return attributeName;
  } else if (attributeName === 'class') {
    return 'class="' + value.join(' ') + '"'; // FIXME: entitify
  } else if (attributeName === 'style') {
    return 'style="' + Object.keys(value)
    // FIXME: entitify
    .map(function (cssProp) {
      return [cssProp, value[cssProp]].join(': ');
    }).join('; ') + '"';
  } else {
    return attributeName + '="' + entitify(value) + '"';
  }
}

function stringifyStartTag(element) {
  var elementName = isInsideHtmlDocument(element) ? element.nodeName.toLowerCase() : element.nodeName;
  var str = '<' + elementName;
  var attrs = getAttributes(element);

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

function ensureSupportedSpecOptions(options) {
  var unsupportedOptions = Object.keys(options).filter(function (key) {
    return key !== 'attributes' && key !== 'name' && key !== 'children' && key !== 'onlyAttributes' && key !== 'textContent';
  });

  if (unsupportedOptions.length > 0) {
    throw new Error('Unsupported option' + (unsupportedOptions.length === 1 ? '' : 's') + ': ' + unsupportedOptions.join(', '));
  }
}

module.exports = {
  name: 'unexpected-dom',
  installInto: function installInto(expect) {
    expect = expect.child();
    expect.use(require('magicpen-prism'));

    function bubbleError(body) {
      return expect.withError(body, function (err) {
        err.errorMode = 'bubble';
        throw err;
      });
    }

    expect.exportType({
      name: 'DOMNode',
      base: 'object',
      identify: function identify(obj) {
        return obj && obj.nodeName && [2, 3, 4, 5, 6, 7, 10, 11, 12].indexOf(obj.nodeType) > -1;
      },
      equal: function equal(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function inspect(element, depth, output) {
        return output.code(element.nodeName + ' "' + element.nodeValue + '"', 'prism-string');
      }
    });

    expect.exportType({
      name: 'DOMComment',
      base: 'DOMNode',
      identify: function identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 8;
      },
      equal: function equal(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function inspect(element, depth, output) {
        return output.code('<!--' + element.nodeValue + '-->', 'html');
      },
      diff: function diff(actual, expected, output, _diff, inspect, equal) {
        var d = _diff('<!--' + actual.nodeValue + '-->', '<!--' + expected.nodeValue + '-->');
        d.inline = true;
        return d;
      }
    });

    // Recognize <!-- ignore --> as a special subtype of DOMComment so it can be targeted by assertions:
    expect.exportType({
      name: 'DOMIgnoreComment',
      base: 'DOMComment',
      identify: function identify(obj) {
        return this.baseType.identify(obj) && /^\s*ignore\s*$/.test(obj.nodeValue);
      }
    });

    expect.exportType({
      name: 'DOMTextNode',
      base: 'DOMNode',
      identify: function identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 3;
      },
      equal: function equal(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function inspect(element, depth, output) {
        return output.code(entitify(element.nodeValue.trim()), 'html');
      },
      diff: function diff(actual, expected, output, _diff2, inspect, equal) {
        var d = _diff2(actual.nodeValue, expected.nodeValue);
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMNodeList',
      base: 'array-like',
      prefix: function prefix(output) {
        return output.text('NodeList[');
      },
      suffix: function suffix(output) {
        return output.text(']');
      },
      similar: function similar(a, b) {
        // Figure out whether a and b are "struturally similar" so they can be diffed inline.
        return a.nodeType === 1 && b.nodeType === 1 && a.nodeName === b.nodeName;
      },
      identify: function identify(obj) {
        return obj && typeof obj.length === 'number' && typeof obj.toString === 'function' && typeof obj.item === 'function' && (
        // With jsdom 6+, nodeList.toString() comes out as '[object Object]', so fall back to the constructor name:
        obj.toString().indexOf('NodeList') !== -1 || obj.constructor && obj.constructor.name === 'NodeList');
      }
    });

    // Fake type to make it possible to build 'to satisfy' diffs to be rendered inline:
    expect.exportType({
      name: 'attachedDOMNodeList',
      base: 'DOMNodeList',
      indent: false,
      prefix: function prefix(output) {
        return output;
      },
      suffix: function suffix(output) {
        return output;
      },
      delimiter: function delimiter(output) {
        return output;
      },
      identify: function identify(obj) {
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
      identify: function identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 10 && 'publicId' in obj;
      },
      inspect: function inspect(doctype, depth, output, _inspect) {
        return output.code('<!DOCTYPE ' + doctype.name + '>', 'html');
      },
      equal: function equal(a, b) {
        return a.toString() === b.toString();
      },
      diff: function diff(actual, expected, output, _diff3) {
        var d = _diff3('<!DOCTYPE ' + actual.name + '>', '<!DOCTYPE ' + expected.name + '>');
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMDocument',
      base: 'DOMNode',
      identify: function identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 9 && obj.documentElement && obj.implementation;
      },
      inspect: function inspect(document, depth, output, _inspect2) {
        for (var i = 0; i < document.childNodes.length; i += 1) {
          output.append(_inspect2(document.childNodes[i]));
        }
        return output;
      },
      diff: function diff(actual, expected, output, _diff4, inspect, equal) {
        output.inline = true;
        output.append(_diff4(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)));
        return output;
      }
    });

    expect.exportType({
      name: 'HTMLDocument',
      base: 'DOMDocument',
      identify: function identify(obj) {
        return this.baseType.identify(obj) && isInsideHtmlDocument(obj);
      }
    });

    expect.exportType({
      name: 'XMLDocument',
      base: 'DOMDocument',
      identify: function identify(obj) {
        return this.baseType.identify(obj) && !isInsideHtmlDocument(obj);
      },
      inspect: function inspect(document, depth, output, _inspect3) {
        output.code('<?xml version="1.0"?>', 'xml');
        for (var i = 0; i < document.childNodes.length; i += 1) {
          output.append(_inspect3(document.childNodes[i], depth - 1));
        }
        return output;
      }
    });

    expect.exportType({
      name: 'DOMDocumentFragment',
      base: 'DOMNode',
      identify: function identify(obj) {
        return obj && obj.nodeType === 11; // In jsdom, documentFragment.toString() does not return [object DocumentFragment]
      },
      inspect: function inspect(documentFragment, depth, output, _inspect4) {
        return output.text('DocumentFragment[').append(_inspect4(documentFragment.childNodes, depth)).text(']');
      },
      diff: function diff(actual, expected, output, _diff5, inspect, equal) {
        output.inline = true;
        output.block(_diff5(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)));
        return output;
      }
    });

    expect.exportType({
      name: 'DOMElement',
      base: 'DOMNode',
      identify: function identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 1 && obj.nodeName && obj.attributes;
      },
      equal: function equal(a, b, _equal) {
        var aIsHtml = isInsideHtmlDocument(a);
        var bIsHtml = isInsideHtmlDocument(b);
        return aIsHtml === bIsHtml && (aIsHtml ? a.nodeName.toLowerCase() === b.nodeName.toLowerCase() : a.nodeName === b.nodeName) && _equal(getAttributes(a), getAttributes(b)) && _equal(a.childNodes, b.childNodes);
      },
      inspect: function inspect(element, depth, output, _inspect5) {
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
              for (var i = 0; i < element.childNodes.length; i += 1) {
                inspectedChildren.push(_inspect5(element.childNodes[i]));
              }
            }

            var width = startTag.length;
            var multipleLines = inspectedChildren.some(function (o) {
              var size = o.size();
              width += size.width;
              return width > 60 || o.height > 1;
            });

            if (multipleLines) {
              output.nl().indentLines();

              inspectedChildren.forEach(function (inspectedChild, index) {
                output.i().block(inspectedChild).nl();
              });

              output.outdentLines();
            } else {
              inspectedChildren.forEach(function (inspectedChild, index) {
                return output.append(inspectedChild);
              });
            }
          }
        }
        output.code(stringifyEndTag(element), 'html');
        return output;
      },

      diffLimit: 512,
      diff: function diff(actual, expected, output, _diff6, inspect, equal) {
        var isHtml = isInsideHtmlDocument(actual);
        output.inline = true;

        if (Math.max(actual.length, expected.length) > this.diffLimit) {
          output.jsComment('Diff suppressed due to size > ' + this.diffLimit);
          return output;
        }

        var emptyElements = actual.childNodes.length === 0 && expected.childNodes.length === 0;
        var conflictingElement = actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase() || !equal(getAttributes(actual), getAttributes(expected));

        if (conflictingElement) {
          var canContinueLine = true;
          output.prismPunctuation('<').prismTag(actual.nodeName.toLowerCase());
          if (actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase()) {
            output.sp().annotationBlock(function (output) {
              return output.error('should be').sp().prismTag(expected.nodeName.toLowerCase());
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
                output.sp().annotationBlock(function (output) {
                  return output.error('should equal').sp().append(inspect(entitify(expectedAttributes[attributeName])));
                }).nl();
                canContinueLine = false;
              }
              delete expectedAttributes[attributeName];
            } else {
              output.sp().annotationBlock(function (output) {
                return output.error('should be removed');
              }).nl();
              canContinueLine = false;
            }
          });
          Object.keys(expectedAttributes).forEach(function (attributeName) {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            output.annotationBlock(function (output) {
              output.error('missing').sp();
              writeAttributeToMagicPen(output, attributeName, expectedAttributes[attributeName], isHtml);
            }).nl();
            canContinueLine = false;
          });
          output.prismPunctuation('>');
        } else {
          output.code(stringifyStartTag(actual), 'html');
        }

        if (!emptyElements) {
          output.nl().indentLines().i().block(_diff6(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes))).nl().outdentLines();
        }

        output.code(stringifyEndTag(actual), 'html');
        return output;
      }
    });

    expect.exportAssertion('<DOMElement> to have (class|classes) <array|string>', function (expect, subject, value) {
      return expect(subject, 'to have attributes', { class: value });
    });

    expect.exportAssertion('<DOMElement> to only have (class|classes) <array|string>', function (expect, subject, value) {
      return expect(subject, 'to have attributes', {
        class: expect.it(function (className) {
          var actualClasses = getClassNamesFromAttributeValue(className);
          if (typeof value === 'string') {
            value = getClassNamesFromAttributeValue(value);
          }
          return bubbleError(function () {
            return expect(actualClasses.sort(), 'to equal', value.sort());
          });
        })
      });
    });

    expect.exportAssertion('<DOMElement> not to have (class|classes) <array|string>', function (expect, subject, value) {
      return expect(subject, 'to have attributes', {
        class: expect.it(function (className) {
          var actualClasses = getClassNamesFromAttributeValue(className);
          var expectedClasses = void 0;
          if (typeof value === 'string') {
            expectedClasses = getClassNamesFromAttributeValue(value);
          } else {
            expectedClasses = value;
          }
          return bubbleError(function () {
            return expect.apply(undefined, [actualClasses, 'not to contain'].concat(_toConsumableArray(expectedClasses)));
          });
        })
      });
    });

    expect.exportAssertion('<DOMTextNode> to [exhaustively] satisfy <DOMTextNode>', function (expect, subject, value) {
      return expect(subject.nodeValue, 'to equal', value.nodeValue);
    });

    expect.exportAssertion('<DOMComment> to [exhaustively] satisfy <DOMComment>', function (expect, subject, value) {
      return expect(subject.nodeValue, 'to equal', value.nodeValue);
    });

    // Avoid rendering a huge object diff when a text node is matched against a different node type:
    expect.exportAssertion('<DOMTextNode> to [exhaustively] satisfy <object>', function (expect, subject, value) {
      return expect.fail();
    });

    // Always passes:
    expect.exportAssertion(
    // Name each subject type to increase the specificity of the assertion
    '<DOMComment|DOMElement|DOMTextNode|DOMDocument|HTMLDocType> to [exhaustively] satisfy <DOMIgnoreComment>', function (expect, subject, value) {});

    // Necessary because this case would otherwise be handled by the above catch-all for <object>:
    expect.exportAssertion('<DOMTextNode> to [exhaustively] satisfy <regexp>', function (expect, _ref, value) {
      var nodeValue = _ref.nodeValue;
      return expect(nodeValue, 'to satisfy', value);
    });

    expect.exportAssertion('<DOMTextNode> to [exhaustively] satisfy <any>', function (expect, _ref2, value) {
      var nodeValue = _ref2.nodeValue;
      return expect(nodeValue, 'to satisfy', value);
    });

    function convertDOMNodeToSatisfySpec(node, isHtml) {
      if (node.nodeType === 10) {
        // HTMLDocType
        return { name: node.nodeName };
      } else if (node.nodeType === 1) {
        // DOMElement
        var name = isHtml ? node.nodeName.toLowerCase() : node.nodeName;

        var result = { name: name };

        if (node.attributes) {
          result.attributes = {};
          for (var i = 0; i < node.attributes.length; i += 1) {
            result.attributes[node.attributes[i].name] = isHtml && isBooleanAttribute(node.attributes[i].name) ? true : node.attributes[i].value || '';
          }
        }
        result.children = Array.prototype.map.call(node.childNodes, function (childNode) {
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
        throw new Error('to satisfy: Node type ' + node.nodeType + ' is not yet supported in the value');
      }
    }

    expect.exportAssertion('<DOMNodeList> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);

      expect.argsOutput = function (output) {
        return output.code(value, isHtml ? 'html' : 'xml');
      };

      return expect(subject, 'to [exhaustively] satisfy', (isHtml ? parseHtml(value, true) : parseXml(value)).childNodes);
    });

    expect.exportAssertion('<DOMNodeList> to [exhaustively] satisfy <DOMNodeList>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      var satisfySpecs = [];
      for (var i = 0; i < value.length; i += 1) {
        satisfySpecs.push(convertDOMNodeToSatisfySpec(value[i], isHtml));
      }
      return expect(subject, 'to [exhaustively] satisfy', satisfySpecs);
    });

    expect.exportAssertion('<DOMDocumentFragment> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);

      expect.argsOutput = function (output) {
        return output.code(value, isHtml ? 'html' : 'xml');
      };

      return expect(subject, 'to [exhaustively] satisfy', isHtml ? parseHtml(value, true) : parseXml(value));
    });

    expect.exportAssertion('<DOMDocumentFragment> to [exhaustively] satisfy <DOMDocumentFragment>', function (expect, subject, _ref3) {
      var childNodes = _ref3.childNodes;

      var isHtml = isInsideHtmlDocument(subject);
      return expect(subject, 'to [exhaustively] satisfy', Array.prototype.map.call(childNodes, function (childNode) {
        return convertDOMNodeToSatisfySpec(childNode, isHtml);
      }));
    });

    expect.exportAssertion('<DOMDocumentFragment> to [exhaustively] satisfy <object|array>', function (expect, _ref4, value) {
      var childNodes = _ref4.childNodes;
      return expect(childNodes, 'to [exhaustively] satisfy', value);
    });

    expect.exportAssertion('<DOMElement> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      var documentFragment = isHtml ? parseHtml(value, true) : parseXml(value);
      if (documentFragment.childNodes.length !== 1) {
        throw new Error('HTMLElement to satisfy string: Only a single node is supported');
      }

      expect.argsOutput = function (output) {
        return output.code(value, isHtml ? 'html' : 'xml');
      };

      return expect(subject, 'to [exhaustively] satisfy', documentFragment.childNodes[0]);
    });

    expect.exportAssertion('<DOMDocument> to [exhaustively] satisfy <string>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      var valueDocument = isHtml ? parseHtml(value, false) : parseXml(value);
      return expect(makeAttachedDOMNodeList(subject.childNodes), 'to [exhaustively] satisfy', Array.prototype.map.call(valueDocument.childNodes, function (childNode) {
        return convertDOMNodeToSatisfySpec(childNode, isHtml);
      }));
    });

    expect.exportAssertion('<DOMDocument> to [exhaustively] satisfy <DOMDocument>', function (expect, subject, _ref5) {
      var childNodes = _ref5.childNodes;

      var isHtml = isInsideHtmlDocument(subject);
      return expect(makeAttachedDOMNodeList(subject.childNodes), 'to [exhaustively] satisfy', Array.prototype.map.call(childNodes, function (childNode) {
        return convertDOMNodeToSatisfySpec(childNode, isHtml);
      }));
    });

    expect.exportAssertion('<DOMElement> to [exhaustively] satisfy <DOMElement>', function (expect, subject, value) {
      return expect(subject, 'to [exhaustively] satisfy', convertDOMNodeToSatisfySpec(value, isInsideHtmlDocument(subject)));
    });

    expect.exportAssertion(['<DOMElement> to [exhaustively] satisfy <DOMTextNode>', '<DOMTextNode> to [exhaustively] satisfy <DOMElement>', '<DOMElement|DOMDocumentFragment|DOMDocument> to [exhaustively] satisfy <regexp>'], function (expect, subject, value) {
      return expect.fail();
    });

    expect.exportAssertion('<DOMElement> to [exhaustively] satisfy <object>', function (expect, subject, value) {
      var isHtml = isInsideHtmlDocument(subject);
      ensureSupportedSpecOptions(value);

      var promiseByKey = {
        name: expect.promise(function () {
          if (value && typeof value.name !== 'undefined') {
            return bubbleError(function () {
              return expect(isHtml ? subject.nodeName.toLowerCase() : subject.nodeName, 'to satisfy', value.name);
            });
          }
        }),
        children: expect.promise(function () {
          if (typeof value.children !== 'undefined') {
            if (typeof value.textContent !== 'undefined') {
              throw new Error('The children and textContent properties are not supported together');
            }

            var contentType = subject.ownerDocument.contentType;
            if (!contentType) {
              // provide a value in the absence of a contentType (IE11)
              contentType = isInsideHtmlDocument(subject) ? 'text/html' : 'application/xml';
            }

            return bubbleError(function () {
              return expect(makeAttachedDOMNodeList(subject.childNodes, contentType), 'to satisfy', value.children);
            });
          } else if (typeof value.textContent !== 'undefined') {
            return bubbleError(function () {
              return expect(subject.textContent, 'to satisfy', value.textContent);
            });
          }
        }),
        attributes: {}
      };

      var onlyAttributes = value && value.onlyAttributes || expect.flags.exhaustively;
      var attrs = getAttributes(subject);
      var expectedAttributes = value && value.attributes;
      var expectedAttributeNames = [];
      var expectedValueByAttributeName = {};

      if (typeof expectedAttributes !== 'undefined') {
        if (typeof expectedAttributes === 'string') {
          expectedAttributes = [expectedAttributes];
        }
        if (Array.isArray(expectedAttributes)) {
          expectedAttributes.forEach(function (attributeName) {
            expectedValueByAttributeName[attributeName] = true;
          });
        } else if (expectedAttributes && (typeof expectedAttributes === 'undefined' ? 'undefined' : _typeof(expectedAttributes)) === 'object') {
          expectedValueByAttributeName = expectedAttributes;
        }
        Object.keys(expectedValueByAttributeName).forEach(function (attributeName) {
          expectedAttributeNames.push(attributeName);
        });

        expectedAttributeNames.forEach(function (attributeName) {
          var attributeValue = subject.getAttribute(attributeName);
          var expectedAttributeValue = expectedValueByAttributeName[attributeName];
          promiseByKey.attributes[attributeName] = expect.promise(function () {
            if (typeof expectedAttributeValue === 'undefined') {
              return bubbleError(function () {
                return expect(subject.hasAttribute(attributeName), 'to be false');
              });
            } else if (isEnumeratedAttribute(attributeName)) {
              var indexOfEnumeratedAttributeValue = enumeratedAttributeValues[attributeName].indexOf(expectedAttributeValue);

              return bubbleError(function () {
                if (indexOfEnumeratedAttributeValue === -1) {
                  expect.fail(function (output) {
                    return output.text('Invalid expected value ').appendInspected(expectedAttributeValue).text('. Supported values include: ').appendItems(enumeratedAttributeValues[attributeName], ', ');
                  });
                }

                expect(attributeValue, 'to satisfy', expectedAttributeValue);
              });
            } else if (expectedAttributeValue === true) {
              return bubbleError(function () {
                return expect(subject.hasAttribute(attributeName), 'to be true');
              });
            } else if (attributeName === 'class' && (typeof expectedAttributeValue === 'string' || Array.isArray(expectedAttributeValue))) {
              var actualClasses = getClassNamesFromAttributeValue(attributeValue);
              var expectedClasses = expectedAttributeValue;
              if (typeof expectedClasses === 'string') {
                expectedClasses = getClassNamesFromAttributeValue(expectedAttributeValue);
              }
              if (onlyAttributes) {
                return bubbleError(function () {
                  return expect(actualClasses.sort(), 'to equal', expectedClasses.sort());
                });
              } else {
                if (expectedClasses.length === 0) {
                  return bubbleError(function () {
                    return expect(expectedClasses, 'to be empty');
                  });
                }
                return bubbleError(function () {
                  return expect.apply(undefined, [actualClasses, 'to contain'].concat(_toConsumableArray(expectedClasses)));
                });
              }
            } else if (attributeName === 'style') {
              var expectedStyleObj = void 0;
              if (typeof expectedValueByAttributeName.style === 'string') {
                validateStyles(expect, expectedValueByAttributeName.style);
                expectedStyleObj = styleStringToObject(expectedValueByAttributeName.style);
              } else {
                expectedStyleObj = expectedValueByAttributeName.style;
              }

              if (onlyAttributes) {
                return bubbleError(function () {
                  return expect(attrs.style, 'to exhaustively satisfy', expectedStyleObj);
                });
              } else {
                return bubbleError(function () {
                  return expect(attrs.style, 'to satisfy', expectedStyleObj);
                });
              }
            } else if (expect.findTypeOf(expectedAttributeValue).is('expect.it')) {
              expect.context.thisObject = subject;
              return bubbleError(function () {
                return expectedAttributeValue(attributeValue, expect.context);
              });
            } else {
              return bubbleError(function () {
                return expect(attributeValue, 'to satisfy', expectedAttributeValue);
              });
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
            diff: function diff(output, _diff7, inspect, equal) {
              output.block(function (output) {
                var seenError = false;
                output.prismPunctuation('<').prismTag(isHtml ? subject.nodeName.toLowerCase() : subject.nodeName);
                if (promiseByKey.name.isRejected()) {
                  seenError = true;
                  var nameError = promiseByKey.name.reason();
                  output.sp().annotationBlock(function (output) {
                    return output.error(nameError && nameError.getLabel() || 'should satisfy').sp().append(inspect(value.name));
                  });
                }
                var inspectedAttributes = [];
                Object.keys(attrs).forEach(function (attributeName) {
                  var attributeOutput = output.clone();
                  var promise = promiseByKey.attributes[attributeName];
                  writeAttributeToMagicPen(attributeOutput, attributeName, attrs[attributeName], isHtml);
                  if (promise && promise.isFulfilled() || !promise && (!onlyAttributes || expectedAttributeNames.indexOf(attributeName) !== -1)) {} else {
                    seenError = true;
                    attributeOutput.sp().annotationBlock(function (output) {
                      if (promise && typeof expectedValueByAttributeName[attributeName] !== 'undefined') {
                        output.appendErrorMessage(promise.reason());
                      } else {
                        // onlyAttributes === true
                        output.error('should be removed');
                      }
                    });
                  }
                  inspectedAttributes.push(attributeOutput);
                });
                expectedAttributeNames.forEach(function (attributeName) {
                  if (!subject.hasAttribute(attributeName)) {
                    var promise = promiseByKey.attributes[attributeName];
                    if (!promise || promise.isRejected()) {
                      seenError = true;
                      var err = promise && promise.reason();
                      var attributeOutput = output.clone().annotationBlock(function (output) {
                        output.error('missing').sp().prismAttrName(attributeName, 'html');
                        if (expectedValueByAttributeName[attributeName] !== true) {
                          output.sp().error(err && err.getLabel() || 'should satisfy').sp().append(inspect(expectedValueByAttributeName[attributeName]));
                        }
                      });
                      inspectedAttributes.push(attributeOutput);
                    }
                  }
                });
                if (inspectedAttributes.length > 0) {
                  if (seenError) {
                    output.nl().indentLines().indent().block(function (output) {
                      inspectedAttributes.forEach(function (item, i) {
                        if (i > 0) {
                          output.nl();
                        }
                        output.append(item);
                      });
                    }).outdentLines().nl();
                  } else {
                    output.sp();
                    inspectedAttributes.forEach(function (item, i) {
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
                var childrenError = promiseByKey.children.isRejected() && promiseByKey.children.reason();
                if (childrenError) {
                  var childrenDiff = childrenError.getDiff(output);
                  if (childrenDiff && childrenDiff.inline) {
                    output.nl().indentLines().i().block(childrenDiff).nl().outdentLines();
                  } else {
                    output.nl().indentLines().i().block(function (output) {
                      for (var i = 0; i < subject.childNodes.length; i += 1) {
                        output.append(inspect(subject.childNodes[i])).nl();
                      }
                    });
                    output.sp().annotationBlock(function (output) {
                      return output.appendErrorMessage(childrenError);
                    });
                    output.nl();
                  }
                } else {
                  for (var i = 0; i < subject.childNodes.length; i += 1) {
                    output.append(inspect(subject.childNodes[i]));
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
    });

    expect.exportAssertion('<DOMElement> to [only] have (attribute|attributes) <string+>', function (expect, subject) {
      for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }

      return expect(subject, 'to [only] have attributes', args);
    });

    expect.exportAssertion('<DOMElement> not to have (attribute|attributes) <array>', function (expect, subject, value) {
      var attributes = getAttributes(subject);

      value.forEach(function (name) {
        delete attributes[name];
      });

      return expect(subject, 'to only have attributes', attributes);
    });

    expect.exportAssertion('<DOMElement> not to have (attribute|attributes) <string+>', function (expect, subject) {
      for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
        args[_key2 - 2] = arguments[_key2];
      }

      return expect(subject, 'not to have attributes', args);
    });

    expect.exportAssertion('<DOMElement> to [only] have (attribute|attributes) <array|object>', function (expect, subject, value) {
      return expect(subject, 'to satisfy', {
        attributes: value,
        onlyAttributes: expect.flags.only
      });
    });

    expect.exportAssertion('<DOMElement> to have [no] (child|children)', function (expect, _ref6) {
      var childNodes = _ref6.childNodes;
      return expect.flags.no ? expect(childNodes, 'to be empty') : expect(childNodes, 'not to be empty');
    });

    expect.exportAssertion('<DOMElement> to have text <any>', function (expect, _ref7, value) {
      var textContent = _ref7.textContent;
      return expect(textContent, 'to satisfy', value);
    });

    expect.exportAssertion('<DOMDocument|DOMElement|DOMDocumentFragment> [when] queried for [first] <string> <assertion?>', function (expect, subject, query) {
      var queryResult = void 0;

      expect.argsOutput[0] = function (output) {
        return output.green(query);
      };
      expect.errorMode = 'nested';

      if (expect.flags.first) {
        queryResult = subject.querySelector(query);
        if (!queryResult) {
          expect.subjectOutput = function (output) {
            return expect.inspect(subject, Infinity, output);
          };

          expect.fail(function (output) {
            return output.error('The selector').sp().jsString(query).sp().error('yielded no results');
          });
        }
      } else {
        queryResult = subject.querySelectorAll(query);
        if (queryResult.length === 0) {
          expect.subjectOutput = function (output) {
            return expect.inspect(subject, Infinity, output);
          };

          expect.fail(function (output) {
            return output.error('The selector').sp().jsString(query).sp().error('yielded no results');
          });
        }
      }
      return expect.shift(queryResult);
    });

    expect.exportAssertion('<DOMDocument|DOMElement|DOMDocumentFragment> to contain [no] elements matching <string>', function (expect, subject, query) {
      if (expect.flags.no) {
        return expect(subject.querySelectorAll(query), 'to satisfy', []);
      }

      expect.subjectOutput = function (output) {
        return expect.inspect(subject, Infinity, output);
      };

      return expect(subject.querySelectorAll(query), 'not to satisfy', []);
    });

    expect.exportAssertion('<DOMDocument|DOMElement|DOMDocumentFragment> [not] to match <string>', function (expect, subject, query) {
      expect.subjectOutput = function (output) {
        return expect.inspect(subject, Infinity, output);
      };

      return expect(matchesSelector(subject, query), '[not] to be true');
    });

    expect.exportAssertion('<string> [when] parsed as (html|HTML) [fragment] <assertion?>', function (expect, subject) {
      expect.errorMode = 'nested';
      return expect.shift(parseHtml(subject, expect.flags.fragment));
    });

    expect.exportAssertion('<string> [when] parsed as (xml|XML) <assertion?>', function (expect, subject) {
      expect.errorMode = 'nested';
      return expect.shift(parseXml(subject));
    });

    function scoreElementAgainstSpec(element, spec) {
      var isTextSimilar = function isTextSimilar(value, valueSpec) {
        var actual = (value || '').trim().toLowerCase();
        if (typeof valueSpec === 'string') {
          if (actual === valueSpec.trim().toLowerCase()) {
            return true;
          }
        } else if (valueSpec instanceof RegExp) {
          if (valueSpec.test(actual)) {
            return true;
          }
        } else if (typeof valueSpec === 'function') {
          return true;
        }

        return false;
      };

      var isHtml = isInsideHtmlDocument(element);

      var score = 0;

      var nodeName = isHtml ? element.nodeName.toLowerCase() : element.nodeName;

      if (isTextSimilar(nodeName, spec.name)) {
        score++;
      }

      if (isTextSimilar(element.textContent, spec.textContent)) {
        score++;
      }

      if (typeof element.hasAttribute === 'function') {
        var attributes = spec.attributes || {};
        var className = attributes['class'];
        var style = attributes.style;

        if (className && element.hasAttribute('class')) {
          if (typeof className === 'string') {
            var expectedClasses = getClassNamesFromAttributeValue(className);
            var actualClasses = getClassNamesFromAttributeValue(element.getAttribute('class'));

            expectedClasses.forEach(function (expectedClass) {
              if (actualClasses.indexOf(expectedClass) !== -1) {
                score++;
              }
            });
          } else if (isTextSimilar(element.getAttribute('class'), className)) {
            score++;
          }
        }

        if (style && element.hasAttribute('style')) {
          var expectedStyles = typeof style === 'string' ? styleStringToObject(style) : style;
          var actualStyles = styleStringToObject(element.getAttribute('style'));

          Object.keys(expectedStyles).forEach(function (styleName) {
            var expectedStyle = expectedStyles[styleName];
            var actualStyle = actualStyles[styleName];

            if (actualStyle) {
              score++;
            }

            if (isTextSimilar(actualStyle, expectedStyle)) {
              score++;
            }
          });
        }

        var specialAttributes = ['style', 'class'];
        var ids = ['id', 'data-test-id', 'data-testid'];

        Object.keys(attributes).forEach(function (attributeName) {
          if (specialAttributes.indexOf(attributeName) !== -1) {
            return; // skip
          }

          if (element.hasAttribute(attributeName)) {
            if (typeof attributes[attributeName] === 'boolean') {
              score++;
            }

            if (element.getAttribute(attributeName) === attributes[attributeName]) {
              score += ids.indexOf(attributeName) === -1 ? 1 : 100;
            }
          } else if (typeof attributes[attributeName] === 'undefined') {
            score++;
          }
        });
      }

      var expectedChildren = spec.children || [];

      expectedChildren.forEach(function (childSpec, i) {
        var child = element.childNodes[i];
        var childType = expect.findTypeOf(child);

        if (!child) {
          return;
        }

        if (typeof childSpec.nodeType === 'number') {
          if (child.nodeType === childSpec.nodeType) {
            if (childType.is('DOMElement')) {
              // Element
              score += scoreElementAgainstSpec(element.childNodes[i], convertDOMNodeToSatisfySpec(childSpec));
            }

            score++;
          } else if (expect.findTypeOf(childSpec).is('DOMIgnoreComment')) {
            score++;
          }
        } else if (childType.is('DOMElement') && (typeof childSpec === 'undefined' ? 'undefined' : _typeof(childSpec)) === 'object') {
          score += scoreElementAgainstSpec(element.childNodes[i], childSpec);
        } else if (childType.is('DOMTextNode') && isTextSimilar(child.nodeValue, childSpec)) {
          score++;
        }
      });

      return score;
    }

    function findMatchesWithGoodScore(data, spec) {
      var elements = typeof data.length === 'number' ? Array.prototype.slice.call(data) : [data];

      var result = [];
      var bestScore = 0;

      elements.forEach(function (element) {
        var score = scoreElementAgainstSpec(element, spec);
        bestScore = Math.max(score, bestScore);

        if (score > 0 && score >= bestScore) {
          result.push({ score: score, element: element });
        }

        for (var i = 0; i < element.childNodes.length; i += 1) {
          var child = element.childNodes[i];
          if (child.nodeType === 1) {
            result.push.apply(result, _toConsumableArray(findMatchesWithGoodScore(child, spec)));
          }
        }
      });

      result.sort(function (a, b) {
        return b.score - a.score;
      });

      if (result.length > 0) {
        var _bestScore = result[0].score;

        return result.filter(function (_ref8) {
          var score = _ref8.score;
          return score === _bestScore;
        });
      }

      return result;
    }

    expect.exportAssertion('<DOMDocument|DOMElement|DOMDocumentFragment|DOMNodeList> [not] to contain <DOMElement|object|string>', function (expect, subject, value) {
      var nodes = subject.childNodes || makeAttachedDOMNodeList(subject);
      var isHtml = isInsideHtmlDocument(subject.childNodes ? subject : nodes);
      var valueType = expect.findTypeOf(value);
      var spec = value;

      if (valueType.is('DOMElement')) {
        spec = convertDOMNodeToSatisfySpec(value, isHtml);
      } else if (valueType.is('string')) {
        var documentFragment = isHtml ? parseHtml(value, true) : parseXml(value);

        if (documentFragment.childNodes.length !== 1) {
          throw new Error('HTMLElement to contain string: Only a single node is supported');
        }

        spec = convertDOMNodeToSatisfySpec(documentFragment.childNodes[0], isHtml);

        if (typeof spec === 'string') {
          throw new Error('HTMLElement to contain string: please provide a HTML structure as a string');
        }

        expect.argsOutput = function (output) {
          return output.appendInspected(documentFragment.childNodes[0]);
        };

        ensureSupportedSpecOptions(spec);
      }

      var scoredElements = findMatchesWithGoodScore(nodes, spec);

      if (expect.flags.not) {
        if (scoredElements.length > 0) {
          return expect.withError(function () {
            return expect(scoredElements.map(function (_ref9) {
              var element = _ref9.element;
              return element;
            }), 'not to have an item satisfying', spec);
          }, function () {
            var bestMatch = scoredElements[0].element;

            expect.subjectOutput = function (output) {
              return expect.inspect(subject, Infinity, output);
            };

            expect.fail({
              diff: function diff(output, _diff8, inspect, equal) {
                return output.error('Found:').nl(2).appendInspected(bestMatch);
              }
            });
          });
        }
      } else {
        if (scoredElements.length === 0) {
          expect.subjectOutput = function (output) {
            return expect.inspect(subject, Infinity, output);
          };
          expect.fail();
        }

        return expect.withError(function () {
          return expect(scoredElements.map(function (_ref10) {
            var element = _ref10.element;
            return element;
          }), 'to have an item satisfying', spec);
        }, function () {
          var bestMatch = scoredElements[0].element;

          return expect(bestMatch, 'to satisfy', spec);
        });
      }
    });
  }
};
},{"./matchesSelector":2,"magicpen-prism":3}],2:[function(require,module,exports){
module.exports = function (elm, selector) {
  var matchFuntion = elm.matchesSelector || elm.mozMatchesSelector || elm.msMatchesSelector || elm.oMatchesSelector || elm.webkitMatchesSelector || function (selector) {
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
var prism = (global.Prism = require('prismjs'));
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
  cpp: 'clike',
  'c#': 'clike',
  java: 'clike',
  'application/graphql': 'graphql'
};

function upperCamelCase(str) {
  return str.replace(/(?:^|-)([a-z])/g, function($0, ch) {
    return ch.toUpperCase();
  });
}

module.exports = {
  name: 'magicpen-prism',
  version: require('../package.json').version,
  installInto: function(magicPen) {
    Object.keys(defaultTheme).forEach(function(styleName) {
      var style = defaultTheme[styleName];
      while (typeof style === 'string' && style in defaultTheme) {
        style = defaultTheme[style];
      }
      magicPen.addStyle(styleName, function(text) {
        this.text(text, style);
      });
    });

    magicPen.addStyle(
      'code',
      function(sourceText, language) {
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
            token.forEach(function(subToken) {
              printTokens(subToken, parentStyle);
            });
          } else if (typeof token === 'string') {
            var upperCamelCasedParentStyle = upperCamelCase(parentStyle);
            token = token.replace(/&lt;/g, '<');
            if (
              that['prism' + capitalizedLanguage + upperCamelCasedParentStyle]
            ) {
              that['prism' + capitalizedLanguage + upperCamelCasedParentStyle](
                token
              );
            } else if (that['prism' + upperCamelCasedParentStyle]) {
              that['prism' + upperCamelCasedParentStyle](token);
            } else if (
              languageDefinition[parentStyle] &&
              languageDefinition[parentStyle].alias
            ) {
              printTokens(token, languageDefinition[parentStyle].alias);
            } else {
              that.text(token);
            }
          } else {
            printTokens(token.content, token.type);
          }
        }
        printTokens(
          prism.tokenize(sourceText, prism.languages[language]),
          'text'
        );
      },
      true
    );
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../package.json":4,"prismjs":7,"prismjs/components/prism-csp.js":5,"prismjs/components/prism-graphql.js":6}],4:[function(require,module,exports){
module.exports={
  "_args": [
    [
      {
        "raw": "magicpen-prism@^3.0.1",
        "scope": null,
        "escapedName": "magicpen-prism",
        "name": "magicpen-prism",
        "rawSpec": "^3.0.1",
        "spec": ">=3.0.1 <4.0.0",
        "type": "range"
      },
      "/Users/alex/Documents/projects/unexpected-dom"
    ]
  ],
  "_from": "magicpen-prism@>=3.0.1 <4.0.0",
  "_hasShrinkwrap": false,
  "_id": "magicpen-prism@3.0.1",
  "_inCache": true,
  "_location": "/magicpen-prism",
  "_nodeVersion": "10.15.1",
  "_npmOperationalInternal": {
    "host": "s3://npm-registry-packages",
    "tmp": "tmp/magicpen-prism_3.0.1_1552750340750_0.6047691017808081"
  },
  "_npmUser": {
    "name": "papandreou",
    "email": "andreaslindpetersen@gmail.com"
  },
  "_npmVersion": "6.4.1",
  "_phantomChildren": {},
  "_requested": {
    "raw": "magicpen-prism@^3.0.1",
    "scope": null,
    "escapedName": "magicpen-prism",
    "name": "magicpen-prism",
    "rawSpec": "^3.0.1",
    "spec": ">=3.0.1 <4.0.0",
    "type": "range"
  },
  "_requiredBy": [
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/magicpen-prism/-/magicpen-prism-3.0.1.tgz",
  "_shasum": "5bf516bb9f8b0fd889548ca452c863cb30e843a1",
  "_shrinkwrap": null,
  "_spec": "magicpen-prism@^3.0.1",
  "_where": "/Users/alex/Documents/projects/unexpected-dom",
  "author": {
    "name": "Andreas Lind",
    "email": "andreaslindpetersen@gmail.com"
  },
  "bugs": {
    "url": "https://github.com/unexpectedjs/magicpen-prism/issues"
  },
  "dependencies": {
    "prismjs": "^1.15.0"
  },
  "description": "Add syntax highlighting support to magicpen via prism.js",
  "devDependencies": {
    "browserify": "^16.2.3",
    "bundle-collapser": "^1.3.0",
    "coveralls": "^3.0.3",
    "eslint": "^5.7.0",
    "eslint-config-prettier": "^4.1.0",
    "eslint-config-standard": "^12.0.0",
    "eslint-plugin-import": "^2.16.0",
    "eslint-plugin-mocha": "^5.3.0",
    "eslint-plugin-node": "^8.0.1",
    "eslint-plugin-promise": "^4.0.1",
    "eslint-plugin-standard": "^4.0.0",
    "magicpen": "^6.0.2",
    "mocha": "^6.0.2",
    "nyc": "^13.3.0",
    "prettier": "^1.16.4",
    "unexpected": "^11.2.0"
  },
  "directories": {},
  "dist": {
    "integrity": "sha512-BNV59p+oTWFF6Pw19QnBEGYV3W6pqRToGIGklXm0RQlE6M9SdLUPhd0QKlPln7LPrEnHvo9E1fPnW0OXJomRXw==",
    "shasum": "5bf516bb9f8b0fd889548ca452c863cb30e843a1",
    "tarball": "https://registry.npmjs.org/magicpen-prism/-/magicpen-prism-3.0.1.tgz",
    "fileCount": 4,
    "unpackedSize": 35339,
    "npm-signature": "-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJcjRcFCRA9TVsSAnZWagAA8rYP/3IN5mSBhOVXBTrb8sk9\nZ1BGaIzg0KdrYyEUm4S1njN8lfqenakc14MDRAD4huFMDH+TWpSdbKX5qj5x\nzoBqQK6H0XlQdQ5vag3pONBz9OGU6mxqjM4pnhogYDWV0SlXjyXuc3PSvQ6H\nRKyJrH7HwSV5gu7DDY9a0gsajXU4Ah6pER/HNGQXZCWESVduwa4EYzk1sqBx\njNvAQxUFfRYcSiVVwfo2ftBE6Muq7/DAyFUFJz8eblFSX4kB5+uopmVHyFEX\ntbhfl1Qyxszrmr/rDuzNi5gecG4tauF6/D3NCtMxR1NOxcsSv2MJiz3FoqT2\nUmKTn+P/Pb7GLNcj73mPF2s6wDXBBrytJR8pIOMD22yV3ZZH0PqD4DsQvjHK\nYnSp+kLVSeB7NdALB+xNVFxRg2fg6rE8CiQJzFt/v+MUsDdMX0sqRGe9n9Eo\nzIASOAJTrbXfC9Ulf01C1mGSbrN779fkKF9tC9k7W+NXziI0EKjn/r8AXe75\nSOXAEVmvafI+35WUlHn1/ho97O3wr+pngEFOERpEX1+NSIbOanSww3LnrLW+\njMEIGGj7N3q7m4zAZdn4giYjekVewLoGMTF9oCzIOcWsYqcbKeVRSFB9YyPt\nOqSkAK8yg2ygtKAgq5+ubXJFxmA6zcT07Zd9GVrUqM94xveCzsUxAtR2NUqG\nVcH0\r\n=evAJ\r\n-----END PGP SIGNATURE-----\r\n"
  },
  "gitHead": "2c72f21e3d1750bcee977867de28a79be3f1e21b",
  "homepage": "https://github.com/unexpectedjs/magicpen-prism#readme",
  "main": "lib/magicPenPrism.js",
  "maintainers": [
    {
      "name": "alexjeffburke",
      "email": "alex@alexjeffburke.com"
    },
    {
      "name": "gustavnikolaj",
      "email": "gustavnikolaj@gmail.com"
    },
    {
      "name": "joelmukuthu",
      "email": "joelmukuthu@gmail.com"
    },
    {
      "name": "papandreou",
      "email": "andreaslindpetersen@gmail.com"
    },
    {
      "name": "sunesimonsen",
      "email": "sune@we-knowhow.dk"
    }
  ],
  "name": "magicpen-prism",
  "nyc": {
    "include": [
      "lib/**"
    ]
  },
  "optionalDependencies": {},
  "readme": "ERROR: No README data found!",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/unexpectedjs/magicpen-prism.git"
  },
  "scripts": {
    "ci": "npm run lint && npm run coverage",
    "coverage": "NODE_ENV=development nyc --reporter=lcov --reporter=text --all -- npm test && echo google-chrome coverage/lcov-report/index.html",
    "lint": "eslint . && prettier --check '**/*.js'",
    "prepublish": "browserify -p bundle-collapser/plugin -e lib/magicPenPrism -s magicPenPrism > magicPenPrism.min.js",
    "test": "mocha"
  },
  "version": "3.0.1"
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
		pattern: /'(?:self|none|strict-dynamic|(?:nonce-|sha(?:256|384|512)-)[a-zA-Z\d+=/]+)'/,
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
	'number': /(?:\B-|\b)\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
	'boolean': /\b(?:true|false)\b/,
	'variable': /\$[a-z_]\w*/i,
	'directive': {
		pattern: /@[a-z_]\w*/i,
		alias: 'function'
	},
	'attr-name': {
		pattern: /[a-z_]\w*(?=\s*(?:\((?:[^()"]|"(?:\\.|[^\\"\r\n])*")*\))?:)/i,
		greedy: true
	},
	'class-name': {
		pattern: /(\b(?:enum|implements|interface|on|scalar|type|union)\s+)[a-zA-Z_]\w*/,
		lookbehind: true
	},
	'fragment': {
		pattern: /(\bfragment\s+|\.{3}\s*(?!on\b))[a-zA-Z_]\w*/,
		lookbehind: true,
		alias: 'function'
	},
	'keyword': /\b(?:enum|fragment|implements|input|interface|mutation|on|query|scalar|schema|type|union)\b/,
	'operator': /[!=|]|\.{3}/,
	'punctuation': /[!(){}\[\]:=,]/,
	'constant': /\b(?!ID\b)[A-Z][A-Z_\d]*\b/
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

var Prism = (function (_self){

// Private helper vars
var lang = /\blang(?:uage)?-([\w-]+)\b/i;
var uniqueId = 0;

var _ = {
	manual: _self.Prism && _self.Prism.manual,
	disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (Array.isArray(tokens)) {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).slice(8, -1);
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function deepClone(o, visited) {
			var clone, id, type = _.util.type(o);
			visited = visited || {};

			switch (type) {
				case 'Object':
					id = _.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = {};
					visited[id] = clone;

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = deepClone(o[key], visited);
						}
					}

					return clone;

				case 'Array':
					id = _.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = [];
					visited[id] = clone;

					o.forEach(function (v, i) {
						clone[i] = deepClone(v, visited);
					});

					return clone;

				default:
					return o;
			}
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
		 * we cannot just provide an object, we need an object and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
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

					// Do not insert token which also occur in insert. See #1525
					if (!insert.hasOwnProperty(token)) {
						ret[token] = grammar[token];
					}
				}
			}

			var old = root[inside];
			root[inside] = ret;

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === old && key != inside) {
					this[key] = ret;
				}
			});

			return ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function DFS(o, callback, type, visited) {
			visited = visited || {};

			var objId = _.util.objId;

			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					var property = o[i],
					    propertyType = _.util.type(property);

					if (propertyType === 'Object' && !visited[objId(property)]) {
						visited[objId(property)] = true;
						DFS(property, callback, null, visited);
					}
					else if (propertyType === 'Array' && !visited[objId(property)]) {
						visited[objId(property)] = true;
						DFS(property, callback, i, visited);
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

		var insertHighlightedCode = function (highlightedCode) {
			env.highlightedCode = highlightedCode;

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
			callback && callback.call(env.element);
		}

		_.hooks.run('before-sanity-check', env);

		if (!env.code) {
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (!env.grammar) {
			insertHighlightedCode(_.util.encode(env.code));
			return;
		}

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				insertHighlightedCode(evt.data);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
		}
	},

	highlight: function (text, grammar, language) {
		var env = {
			code: text,
			grammar: grammar,
			language: language
		};
		_.hooks.run('before-tokenize', env);
		env.tokens = _.tokenize(env.code, env.grammar);
		_.hooks.run('after-tokenize', env);
		return Token.stringify(_.util.encode(env.tokens), env.language);
	},

	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
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

					if (greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						var match = pattern.exec(text);
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

						// If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						if (strarr[i] instanceof Token) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						pattern.lastIndex = 0;

						var match = pattern.exec(str),
							delNum = 1;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1] ? match[1].length : 0;
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

	tokenize: function(text, grammar) {
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
	},

	Token: Token
};

_self.Prism = _;

function Token(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
}

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (Array.isArray(o)) {
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
		var aliases = Array.isArray(o.alias) ? o.alias : [o.alias];
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
		return _;
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

	return _;
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

return _;

})(_self);

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
		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/i,
		greedy: true,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,
				inside: {
					'punctuation': [
						/^=/,
						{
							pattern: /^(\s*)["']|["']$/,
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

Object.defineProperty(Prism.languages.markup.tag, 'addInlined', {
	/**
	 * Adds an inlined language to markup.
	 *
	 * An example of an inlined language is CSS with `<style>` tags.
	 *
	 * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addInlined('style', 'css');
	 */
	value: function addInlined(tagName, lang) {
		var includedCdataInside = {};
		includedCdataInside['language-' + lang] = {
			pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
			lookbehind: true,
			inside: Prism.languages[lang]
		};
		includedCdataInside['cdata'] = /^<!\[CDATA\[|\]\]>$/i;

		var inside = {
			'included-cdata': {
				pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
				inside: includedCdataInside
			}
		};
		inside['language-' + lang] = {
			pattern: /[\s\S]+/,
			inside: Prism.languages[lang]
		};

		var def = {};
		def[tagName] = {
			pattern: RegExp(/(<__[\s\S]*?>)(?:<!\[CDATA\[[\s\S]*?\]\]>\s*|[\s\S])*?(?=<\/__>)/.source.replace(/__/g, tagName), 'i'),
			lookbehind: true,
			greedy: true,
			inside: inside
		};

		Prism.languages.insertBefore('markup', 'cdata', def);
	}
});

Prism.languages.xml = Prism.languages.extend('markup', {});
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

(function (Prism) {

	var string = /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;

	Prism.languages.css = {
		'comment': /\/\*[\s\S]*?\*\//,
		'atrule': {
			pattern: /@[\w-]+?[\s\S]*?(?:;|(?=\s*\{))/i,
			inside: {
				'rule': /@[\w-]+/
				// See rest below
			}
		},
		'url': RegExp('url\\((?:' + string.source + '|.*?)\\)', 'i'),
		'selector': RegExp('[^{}\\s](?:[^{};"\']|' + string.source + ')*?(?=\\s*\\{)'),
		'string': {
			pattern: string,
			greedy: true
		},
		'property': /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
		'important': /!important\b/i,
		'function': /[-a-z0-9]+(?=\()/i,
		'punctuation': /[(){};:,]/
	};

	Prism.languages.css['atrule'].inside.rest = Prism.languages.css;

	var markup = Prism.languages.markup;
	if (markup) {
		markup.tag.addInlined('style', 'css');

		Prism.languages.insertBefore('inside', 'attr-value', {
			'style-attr': {
				pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
				inside: {
					'attr-name': {
						pattern: /^\s*style/i,
						inside: markup.tag.inside
					},
					'punctuation': /^\s*=\s*['"]|['"]\s*$/,
					'attr-value': {
						pattern: /.+/i,
						inside: Prism.languages.css
					}
				},
				alias: 'language-css'
			}
		}, markup.tag);
	}

}(Prism));


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
			lookbehind: true,
			greedy: true
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
	'function': /\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'class-name': [
		Prism.languages.clike['class-name'],
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])[_$A-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\.(?:prototype|constructor))/,
			lookbehind: true
		}
	],
	'keyword': [
		{
			pattern: /((?:^|})\s*)(?:catch|finally)\b/,
			lookbehind: true
		},
		{
			pattern: /(^|[^.])\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
			lookbehind: true
		},
	],
	'number': /\b(?:(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+)n?|\d+n|NaN|Infinity)\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})\]]))/,
		lookbehind: true,
		greedy: true
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/,
		alias: 'function'
	},
	'parameter': [
		{
			pattern: /(function(?:\s+[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)?\s*\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\))/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=>)/i,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*=>)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*\s*)\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*\{)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		}
	],
	'constant': /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\[\s\S]|\${[^}]+}|[^\\`])*`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\${[^}]+}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\${|}$/,
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
	Prism.languages.markup.tag.addInlined('script', 'javascript');
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	/**
	 * @param {Element} [container=document]
	 */
	self.Prism.fileHighlight = function(container) {
		container = container || document;

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

		Array.prototype.slice.call(container.querySelectorAll('pre[data-src]')).forEach(function (pre) {
			// ignore if already loaded
			if (pre.hasAttribute('data-src-loaded')) {
				return;
			}

			// load current
			var src = pre.getAttribute('data-src');

			var language, parent = pre;
			var lang = /\blang(?:uage)?-([\w-]+)\b/i;
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
						// mark as loaded
						pre.setAttribute('data-src-loaded', '');
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

		if (Prism.plugins.toolbar) {
			Prism.plugins.toolbar.registerButton('download-file', function (env) {
				var pre = env.element.parentNode;
				if (!pre || !/pre/i.test(pre.nodeName) || !pre.hasAttribute('data-src') || !pre.hasAttribute('data-download-link')) {
					return;
				}
				var src = pre.getAttribute('data-src');
				var a = document.createElement('a');
				a.textContent = pre.getAttribute('data-download-link-label') || 'Download';
				a.setAttribute('download', '');
				a.href = src;
				return a;
			});
		}

	};

	document.addEventListener('DOMContentLoaded', function () {
		// execute inside handler, for dropping Event as argument
		self.Prism.fileHighlight();
	});

})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvbWF0Y2hlc1NlbGVjdG9yLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL2xpYi9tYWdpY1BlblByaXNtLmpzIiwibm9kZV9tb2R1bGVzL21hZ2ljcGVuLXByaXNtL3BhY2thZ2UuanNvbiIsIm5vZGVfbW9kdWxlcy9wcmlzbWpzL2NvbXBvbmVudHMvcHJpc20tY3NwLmpzIiwibm9kZV9tb2R1bGVzL3ByaXNtanMvY29tcG9uZW50cy9wcmlzbS1ncmFwaHFsLmpzIiwibm9kZV9tb2R1bGVzL3ByaXNtanMvcHJpc20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdnlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgJiYgb2JqICE9PSBTeW1ib2wucHJvdG90eXBlID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7IH07XG5cbmZ1bmN0aW9uIF90b0NvbnN1bWFibGVBcnJheShhcnIpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyBmb3IgKHZhciBpID0gMCwgYXJyMiA9IEFycmF5KGFyci5sZW5ndGgpOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7IGFycjJbaV0gPSBhcnJbaV07IH0gcmV0dXJuIGFycjI7IH0gZWxzZSB7IHJldHVybiBBcnJheS5mcm9tKGFycik7IH0gfVxuXG4vKmdsb2JhbCBET01QYXJzZXIqL1xudmFyIG1hdGNoZXNTZWxlY3RvciA9IHJlcXVpcmUoJy4vbWF0Y2hlc1NlbGVjdG9yJyk7XG5cbmZ1bmN0aW9uIGdldEpTRE9NKCkge1xuICB0cnkge1xuICAgIHJldHVybiByZXF1aXJlKCcnICsgJ2pzZG9tJyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZC1kb206IFJ1bm5pbmcgb3V0c2lkZSBhIGJyb3dzZXIgKG9yIGluIGEgYnJvd3NlciB3aXRob3V0IERPTVBhcnNlciksIGJ1dCBjb3VsZCBub3QgZmluZCB0aGUgYGpzZG9tYCBtb2R1bGUuIFBsZWFzZSBucG0gaW5zdGFsbCBqc2RvbSB0byBtYWtlIHRoaXMgd29yay4nKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRIdG1sRG9jdW1lbnQoc3RyKSB7XG4gIGlmICh0eXBlb2YgRE9NUGFyc2VyICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHN0ciwgJ3RleHQvaHRtbCcpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24gJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KSB7XG4gICAgdmFyIGh0bWxEb2N1bWVudCA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCgnJyk7XG4gICAgaHRtbERvY3VtZW50Lm9wZW4oKTtcbiAgICBodG1sRG9jdW1lbnQud3JpdGUoc3RyKTtcbiAgICBodG1sRG9jdW1lbnQuY2xvc2UoKTtcbiAgICByZXR1cm4gaHRtbERvY3VtZW50O1xuICB9IGVsc2Uge1xuICAgIHZhciBqc2RvbSA9IGdldEpTRE9NKCk7XG5cbiAgICByZXR1cm4ganNkb20uSlNET00gPyBuZXcganNkb20uSlNET00oc3RyKS53aW5kb3cuZG9jdW1lbnQgOiBqc2RvbS5qc2RvbShzdHIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlSHRtbChzdHIsIGlzRnJhZ21lbnQpIHtcbiAgaWYgKGlzRnJhZ21lbnQpIHtcbiAgICBzdHIgPSAnPGh0bWw+PGhlYWQ+PC9oZWFkPjxib2R5PicgKyBzdHIgKyAnPC9ib2R5PjwvaHRtbD4nO1xuICB9XG4gIHZhciBodG1sRG9jdW1lbnQgPSBnZXRIdG1sRG9jdW1lbnQoc3RyKTtcblxuICBpZiAoaXNGcmFnbWVudCkge1xuICAgIHZhciBib2R5ID0gaHRtbERvY3VtZW50LmJvZHk7XG4gICAgdmFyIGRvY3VtZW50RnJhZ21lbnQgPSBodG1sRG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIGlmIChib2R5KSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJvZHkuY2hpbGROb2Rlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBkb2N1bWVudEZyYWdtZW50LmFwcGVuZENoaWxkKGJvZHkuY2hpbGROb2Rlc1tpXS5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZG9jdW1lbnRGcmFnbWVudDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gaHRtbERvY3VtZW50O1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlWG1sKHN0cikge1xuICBpZiAodHlwZW9mIERPTVBhcnNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhzdHIsICd0ZXh0L3htbCcpO1xuICB9IGVsc2Uge1xuICAgIHZhciBqc2RvbSA9IGdldEpTRE9NKCk7XG5cbiAgICBpZiAoanNkb20uSlNET00pIHtcbiAgICAgIHJldHVybiBuZXcganNkb20uSlNET00oc3RyLCB7IGNvbnRlbnRUeXBlOiAndGV4dC94bWwnIH0pLndpbmRvdy5kb2N1bWVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGpzZG9tLmpzZG9tKHN0ciwgeyBwYXJzaW5nTW9kZTogJ3htbCcgfSk7XG4gICAgfVxuICB9XG59XG5cbi8vIEZyb20gaHRtbC1taW5pZmllclxudmFyIGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXMgPSB7XG4gIGRyYWdnYWJsZTogWyd0cnVlJywgJ2ZhbHNlJ10gLy8gZGVmYXVsdHMgdG8gJ2F1dG8nXG59O1xuXG52YXIgbWF0Y2hTaW1wbGVBdHRyaWJ1dGUgPSAvXig/OmFsbG93ZnVsbHNjcmVlbnxhc3luY3xhdXRvZm9jdXN8YXV0b3BsYXl8Y2hlY2tlZHxjb21wYWN0fGNvbnRyb2xzfGRlY2xhcmV8ZGVmYXVsdHxkZWZhdWx0Y2hlY2tlZHxkZWZhdWx0bXV0ZWR8ZGVmYXVsdHNlbGVjdGVkfGRlZmVyfGRpc2FibGVkfGVuYWJsZWR8Zm9ybW5vdmFsaWRhdGV8aGlkZGVufGluZGV0ZXJtaW5hdGV8aW5lcnR8aXNtYXB8aXRlbXNjb3BlfGxvb3B8bXVsdGlwbGV8bXV0ZWR8bm9ocmVmfG5vcmVzaXplfG5vc2hhZGV8bm92YWxpZGF0ZXxub3dyYXB8b3BlbnxwYXVzZW9uZXhpdHxyZWFkb25seXxyZXF1aXJlZHxyZXZlcnNlZHxzY29wZWR8c2VhbWxlc3N8c2VsZWN0ZWR8c29ydGFibGV8c3BlbGxjaGVja3x0cnVlc3BlZWR8dHlwZW11c3RtYXRjaHx2aXNpYmxlKSQvaTtcblxuZnVuY3Rpb24gaXNCb29sZWFuQXR0cmlidXRlKGF0dHJOYW1lKSB7XG4gIHJldHVybiBtYXRjaFNpbXBsZUF0dHJpYnV0ZS50ZXN0KGF0dHJOYW1lKTtcbn1cblxuZnVuY3Rpb24gaXNFbnVtZXJhdGVkQXR0cmlidXRlKGF0dHJOYW1lKSB7XG4gIHJldHVybiBhdHRyTmFtZSBpbiBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVN0eWxlcyhleHBlY3QsIHN0cikge1xuICB2YXIgaW52YWxpZFN0eWxlcyA9IHN0ci5zcGxpdCgnOycpLmZpbHRlcihmdW5jdGlvbiAocGFydCkge1xuICAgIHJldHVybiAhL15cXHMqKFxcd3wtKStcXHMqOlxccyooIyg/OlswLTlhLWZBLUZdezN9KXsxLDJ9fFteI10rKVxccyokfF4kLy50ZXN0KHBhcnQpO1xuICB9KTtcblxuICBpZiAoaW52YWxpZFN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgIGV4cGVjdC5mYWlsKCdFeHBlY3RhdGlvbiBjb250YWlucyBpbnZhbGlkIHN0eWxlczogezB9JywgaW52YWxpZFN0eWxlcy5qb2luKCc7JykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0eWxlU3RyaW5nVG9PYmplY3Qoc3RyKSB7XG4gIHZhciBzdHlsZXMgPSB7fTtcblxuICBzdHIuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uIChydWxlKSB7XG4gICAgdmFyIHR1cGxlID0gcnVsZS5zcGxpdCgnOicpLm1hcChmdW5jdGlvbiAocGFydCkge1xuICAgICAgcmV0dXJuIHBhcnQudHJpbSgpO1xuICAgIH0pO1xuICAgIC8vIEd1YXJkIGFnYWluc3QgZW1wdHkgdG91cGxlc1xuICAgIGlmICh0dXBsZVswXSAmJiB0dXBsZVsxXSkge1xuICAgICAgc3R5bGVzW3R1cGxlWzBdXSA9IHR1cGxlWzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSkge1xuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09ICcnKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgdmFyIGNsYXNzTmFtZXMgPSBhdHRyaWJ1dGVWYWx1ZS5zcGxpdCgvXFxzKy8pO1xuICBpZiAoY2xhc3NOYW1lcy5sZW5ndGggPT09IDEgJiYgY2xhc3NOYW1lc1swXSA9PT0gJycpIHtcbiAgICBjbGFzc05hbWVzLnBvcCgpO1xuICB9XG4gIHJldHVybiBjbGFzc05hbWVzO1xufVxuXG5mdW5jdGlvbiBpc0luc2lkZUh0bWxEb2N1bWVudChub2RlKSB7XG4gIHZhciBvd25lckRvY3VtZW50ID0gbm9kZS5ub2RlVHlwZSA9PT0gOSAmJiBub2RlLmRvY3VtZW50RWxlbWVudCAmJiBub2RlLmltcGxlbWVudGF0aW9uID8gbm9kZSA6IG5vZGUub3duZXJEb2N1bWVudDtcblxuICBpZiAob3duZXJEb2N1bWVudC5jb250ZW50VHlwZSkge1xuICAgIHJldHVybiBvd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb3duZXJEb2N1bWVudC50b1N0cmluZygpID09PSAnW29iamVjdCBIVE1MRG9jdW1lbnRdJztcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGVsZW1lbnQpO1xuICB2YXIgYXR0cnMgPSBlbGVtZW50LmF0dHJpYnV0ZXM7XG4gIHZhciByZXN1bHQgPSB7fTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgaWYgKGF0dHJzW2ldLm5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IGF0dHJzW2ldLnZhbHVlICYmIGF0dHJzW2ldLnZhbHVlLnNwbGl0KCcgJykgfHwgW107XG4gICAgfSBlbHNlIGlmIChhdHRyc1tpXS5uYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBzdHlsZVN0cmluZ1RvT2JqZWN0KGF0dHJzW2ldLnZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gaXNIdG1sICYmIGlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyc1tpXS5uYW1lKSA/IHRydWUgOiBhdHRyc1tpXS52YWx1ZSB8fCAnJztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBlbnRpdGlmeSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpIHtcbiAgcmV0dXJuICgvKD86YXJlYXxiYXNlfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKS9pLnRlc3QoZWxlbWVudE5hbWUpXG4gICk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihvdXRwdXQsIGF0dHJpYnV0ZU5hbWUsIHZhbHVlLCBpc0h0bWwpIHtcbiAgb3V0cHV0LnByaXNtQXR0ck5hbWUoYXR0cmlidXRlTmFtZSk7XG4gIGlmICghaXNIdG1sIHx8ICFpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICBpZiAoYXR0cmlidXRlTmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5qb2luKCcgJyk7XG4gICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICB2YWx1ZSA9IE9iamVjdC5rZXlzKHZhbHVlKS5tYXAoZnVuY3Rpb24gKGNzc1Byb3ApIHtcbiAgICAgICAgcmV0dXJuIGNzc1Byb3AgKyAnOiAnICsgdmFsdWVbY3NzUHJvcF07XG4gICAgICB9KS5qb2luKCc7ICcpO1xuICAgIH1cbiAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPVwiJykucHJpc21BdHRyVmFsdWUoZW50aXRpZnkodmFsdWUpKS5wcmlzbVB1bmN0dWF0aW9uKCdcIicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNCb29sZWFuQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpIHx8IGlzRW51bWVyYXRlZEF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSkge1xuICAgIHJldHVybiBhdHRyaWJ1dGVOYW1lO1xuICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdjbGFzcycpIHtcbiAgICByZXR1cm4gJ2NsYXNzPVwiJyArIHZhbHVlLmpvaW4oJyAnKSArICdcIic7IC8vIEZJWE1FOiBlbnRpdGlmeVxuICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICByZXR1cm4gJ3N0eWxlPVwiJyArIE9iamVjdC5rZXlzKHZhbHVlKVxuICAgIC8vIEZJWE1FOiBlbnRpdGlmeVxuICAgIC5tYXAoZnVuY3Rpb24gKGNzc1Byb3ApIHtcbiAgICAgIHJldHVybiBbY3NzUHJvcCwgdmFsdWVbY3NzUHJvcF1dLmpvaW4oJzogJyk7XG4gICAgfSkuam9pbignOyAnKSArICdcIic7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZU5hbWUgKyAnPVwiJyArIGVudGl0aWZ5KHZhbHVlKSArICdcIic7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5U3RhcnRUYWcoZWxlbWVudCkge1xuICB2YXIgZWxlbWVudE5hbWUgPSBpc0luc2lkZUh0bWxEb2N1bWVudChlbGVtZW50KSA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG4gIHZhciBzdHIgPSAnPCcgKyBlbGVtZW50TmFtZTtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcblxuICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgc3RyICs9ICcgJyArIHN0cmluZ2lmeUF0dHJpYnV0ZShrZXksIGF0dHJzW2tleV0pO1xuICB9KTtcblxuICBzdHIgKz0gJz4nO1xuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlFbmRUYWcoZWxlbWVudCkge1xuICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoZWxlbWVudCk7XG4gIHZhciBlbGVtZW50TmFtZSA9IGlzSHRtbCA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG4gIGlmIChpc0h0bWwgJiYgaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkgJiYgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJzwvJyArIGVsZW1lbnROYW1lICsgJz4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZVN1cHBvcnRlZFNwZWNPcHRpb25zKG9wdGlvbnMpIHtcbiAgdmFyIHVuc3VwcG9ydGVkT3B0aW9ucyA9IE9iamVjdC5rZXlzKG9wdGlvbnMpLmZpbHRlcihmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIGtleSAhPT0gJ2F0dHJpYnV0ZXMnICYmIGtleSAhPT0gJ25hbWUnICYmIGtleSAhPT0gJ2NoaWxkcmVuJyAmJiBrZXkgIT09ICdvbmx5QXR0cmlidXRlcycgJiYga2V5ICE9PSAndGV4dENvbnRlbnQnO1xuICB9KTtcblxuICBpZiAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG9wdGlvbicgKyAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnKSArICc6ICcgKyB1bnN1cHBvcnRlZE9wdGlvbnMuam9pbignLCAnKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG5hbWU6ICd1bmV4cGVjdGVkLWRvbScsXG4gIGluc3RhbGxJbnRvOiBmdW5jdGlvbiBpbnN0YWxsSW50byhleHBlY3QpIHtcbiAgICBleHBlY3QgPSBleHBlY3QuY2hpbGQoKTtcbiAgICBleHBlY3QudXNlKHJlcXVpcmUoJ21hZ2ljcGVuLXByaXNtJykpO1xuXG4gICAgZnVuY3Rpb24gYnViYmxlRXJyb3IoYm9keSkge1xuICAgICAgcmV0dXJuIGV4cGVjdC53aXRoRXJyb3IoYm9keSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBlcnIuZXJyb3JNb2RlID0gJ2J1YmJsZSc7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlJyxcbiAgICAgIGJhc2U6ICdvYmplY3QnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlTmFtZSAmJiBbMiwgMywgNCwgNSwgNiwgNywgMTAsIDExLCAxMl0uaW5kZXhPZihvYmoubm9kZVR5cGUpID4gLTE7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIGVxdWFsKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiBpbnNwZWN0KGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVsZW1lbnQubm9kZU5hbWUgKyAnIFwiJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJ1wiJywgJ3ByaXNtLXN0cmluZycpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUNvbW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gODtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gZXF1YWwoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUgPT09IGIubm9kZVZhbHVlO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIGluc3BlY3QoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoJzwhLS0nICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnLS0+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiBkaWZmKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgX2RpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gX2RpZmYoJzwhLS0nICsgYWN0dWFsLm5vZGVWYWx1ZSArICctLT4nLCAnPCEtLScgKyBleHBlY3RlZC5ub2RlVmFsdWUgKyAnLS0+Jyk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBSZWNvZ25pemUgPCEtLSBpZ25vcmUgLS0+IGFzIGEgc3BlY2lhbCBzdWJ0eXBlIG9mIERPTUNvbW1lbnQgc28gaXQgY2FuIGJlIHRhcmdldGVkIGJ5IGFzc2VydGlvbnM6XG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUlnbm9yZUNvbW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTUNvbW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIC9eXFxzKmlnbm9yZVxccyokLy50ZXN0KG9iai5ub2RlVmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTVRleHROb2RlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiBpZGVudGlmeShvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDM7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIGVxdWFsKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiBpbnNwZWN0KGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVudGl0aWZ5KGVsZW1lbnQubm9kZVZhbHVlLnRyaW0oKSksICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gZGlmZihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIF9kaWZmMiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBfZGlmZjIoYWN0dWFsLm5vZGVWYWx1ZSwgZXhwZWN0ZWQubm9kZVZhbHVlKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlTGlzdCcsXG4gICAgICBiYXNlOiAnYXJyYXktbGlrZScsXG4gICAgICBwcmVmaXg6IGZ1bmN0aW9uIHByZWZpeChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCdOb2RlTGlzdFsnKTtcbiAgICAgIH0sXG4gICAgICBzdWZmaXg6IGZ1bmN0aW9uIHN1ZmZpeChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgc2ltaWxhcjogZnVuY3Rpb24gc2ltaWxhcihhLCBiKSB7XG4gICAgICAgIC8vIEZpZ3VyZSBvdXQgd2hldGhlciBhIGFuZCBiIGFyZSBcInN0cnV0dXJhbGx5IHNpbWlsYXJcIiBzbyB0aGV5IGNhbiBiZSBkaWZmZWQgaW5saW5lLlxuICAgICAgICByZXR1cm4gYS5ub2RlVHlwZSA9PT0gMSAmJiBiLm5vZGVUeXBlID09PSAxICYmIGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWU7XG4gICAgICB9LFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubGVuZ3RoID09PSAnbnVtYmVyJyAmJiB0eXBlb2Ygb2JqLnRvU3RyaW5nID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvYmouaXRlbSA9PT0gJ2Z1bmN0aW9uJyAmJiAoXG4gICAgICAgIC8vIFdpdGgganNkb20gNissIG5vZGVMaXN0LnRvU3RyaW5nKCkgY29tZXMgb3V0IGFzICdbb2JqZWN0IE9iamVjdF0nLCBzbyBmYWxsIGJhY2sgdG8gdGhlIGNvbnN0cnVjdG9yIG5hbWU6XG4gICAgICAgIG9iai50b1N0cmluZygpLmluZGV4T2YoJ05vZGVMaXN0JykgIT09IC0xIHx8IG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IubmFtZSA9PT0gJ05vZGVMaXN0Jyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBGYWtlIHR5cGUgdG8gbWFrZSBpdCBwb3NzaWJsZSB0byBidWlsZCAndG8gc2F0aXNmeScgZGlmZnMgdG8gYmUgcmVuZGVyZWQgaW5saW5lOlxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdhdHRhY2hlZERPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlTGlzdCcsXG4gICAgICBpbmRlbnQ6IGZhbHNlLFxuICAgICAgcHJlZml4OiBmdW5jdGlvbiBwcmVmaXgob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgc3VmZml4OiBmdW5jdGlvbiBzdWZmaXgob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgZGVsaW1pdGVyOiBmdW5jdGlvbiBkZWxpbWl0ZXIob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5faXNBdHRhY2hlZERPTU5vZGVMaXN0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoZG9tTm9kZUxpc3QsIGNvbnRlbnRUeXBlKSB7XG4gICAgICB2YXIgYXR0YWNoZWRET01Ob2RlTGlzdCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb21Ob2RlTGlzdC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBhdHRhY2hlZERPTU5vZGVMaXN0LnB1c2goZG9tTm9kZUxpc3RbaV0pO1xuICAgICAgfVxuICAgICAgYXR0YWNoZWRET01Ob2RlTGlzdC5faXNBdHRhY2hlZERPTU5vZGVMaXN0ID0gdHJ1ZTtcbiAgICAgIGF0dGFjaGVkRE9NTm9kZUxpc3Qub3duZXJEb2N1bWVudCA9IHsgY29udGVudFR5cGU6IGNvbnRlbnRUeXBlIH07XG4gICAgICByZXR1cm4gYXR0YWNoZWRET01Ob2RlTGlzdDtcbiAgICB9XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnSFRNTERvY1R5cGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gMTAgJiYgJ3B1YmxpY0lkJyBpbiBvYmo7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gaW5zcGVjdChkb2N0eXBlLCBkZXB0aCwgb3V0cHV0LCBfaW5zcGVjdCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoJzwhRE9DVFlQRSAnICsgZG9jdHlwZS5uYW1lICsgJz4nLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiBlcXVhbChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLnRvU3RyaW5nKCkgPT09IGIudG9TdHJpbmcoKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiBkaWZmKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgX2RpZmYzKSB7XG4gICAgICAgIHZhciBkID0gX2RpZmYzKCc8IURPQ1RZUEUgJyArIGFjdHVhbC5uYW1lICsgJz4nLCAnPCFET0NUWVBFICcgKyBleHBlY3RlZC5uYW1lICsgJz4nKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Eb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gaWRlbnRpZnkob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSA5ICYmIG9iai5kb2N1bWVudEVsZW1lbnQgJiYgb2JqLmltcGxlbWVudGF0aW9uO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIGluc3BlY3QoZG9jdW1lbnQsIGRlcHRoLCBvdXRwdXQsIF9pbnNwZWN0Mikge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKF9pbnNwZWN0Mihkb2N1bWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiBkaWZmKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgX2RpZmY0LCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICBvdXRwdXQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgb3V0cHV0LmFwcGVuZChfZGlmZjQobWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoYWN0dWFsLmNoaWxkTm9kZXMpLCBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChleHBlY3RlZC5jaGlsZE5vZGVzKSkpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIGlzSW5zaWRlSHRtbERvY3VtZW50KG9iaik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0VHlwZSh7XG4gICAgICBuYW1lOiAnWE1MRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTURvY3VtZW50JyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiBpZGVudGlmeShvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmFzZVR5cGUuaWRlbnRpZnkob2JqKSAmJiAhaXNJbnNpZGVIdG1sRG9jdW1lbnQob2JqKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiBpbnNwZWN0KGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBfaW5zcGVjdDMpIHtcbiAgICAgICAgb3V0cHV0LmNvZGUoJzw/eG1sIHZlcnNpb249XCIxLjBcIj8+JywgJ3htbCcpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKF9pbnNwZWN0Myhkb2N1bWVudC5jaGlsZE5vZGVzW2ldLCBkZXB0aCAtIDEpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTURvY3VtZW50RnJhZ21lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIGlkZW50aWZ5KG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMTE7IC8vIEluIGpzZG9tLCBkb2N1bWVudEZyYWdtZW50LnRvU3RyaW5nKCkgZG9lcyBub3QgcmV0dXJuIFtvYmplY3QgRG9jdW1lbnRGcmFnbWVudF1cbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiBpbnNwZWN0KGRvY3VtZW50RnJhZ21lbnQsIGRlcHRoLCBvdXRwdXQsIF9pbnNwZWN0NCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ0RvY3VtZW50RnJhZ21lbnRbJykuYXBwZW5kKF9pbnNwZWN0NChkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXMsIGRlcHRoKSkudGV4dCgnXScpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIGRpZmYoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBfZGlmZjUsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIG91dHB1dC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICBvdXRwdXQuYmxvY2soX2RpZmY1KG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGFjdHVhbC5jaGlsZE5vZGVzKSwgbWFrZUF0dGFjaGVkRE9NTm9kZUxpc3QoZXhwZWN0ZWQuY2hpbGROb2RlcykpKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01FbGVtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiBpZGVudGlmeShvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDEgJiYgb2JqLm5vZGVOYW1lICYmIG9iai5hdHRyaWJ1dGVzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiBlcXVhbChhLCBiLCBfZXF1YWwpIHtcbiAgICAgICAgdmFyIGFJc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChhKTtcbiAgICAgICAgdmFyIGJJc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChiKTtcbiAgICAgICAgcmV0dXJuIGFJc0h0bWwgPT09IGJJc0h0bWwgJiYgKGFJc0h0bWwgPyBhLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGIubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWUpICYmIF9lcXVhbChnZXRBdHRyaWJ1dGVzKGEpLCBnZXRBdHRyaWJ1dGVzKGIpKSAmJiBfZXF1YWwoYS5jaGlsZE5vZGVzLCBiLmNoaWxkTm9kZXMpO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIGluc3BlY3QoZWxlbWVudCwgZGVwdGgsIG91dHB1dCwgX2luc3BlY3Q1KSB7XG4gICAgICAgIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgdmFyIHN0YXJ0VGFnID0gc3RyaW5naWZ5U3RhcnRUYWcoZWxlbWVudCk7XG5cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RhcnRUYWcsICdodG1sJyk7XG4gICAgICAgIGlmIChlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGlmIChkZXB0aCA9PT0gMSkge1xuICAgICAgICAgICAgb3V0cHV0LnRleHQoJy4uLicpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgaW5zcGVjdGVkQ2hpbGRyZW4gPSBbXTtcbiAgICAgICAgICAgIGlmIChlbGVtZW50TmFtZSA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgICAgICAgICAgdmFyIHR5cGUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpO1xuICAgICAgICAgICAgICBpZiAoIXR5cGUgfHwgL2phdmFzY3JpcHQvLnRlc3QodHlwZSkpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ2phdmFzY3JpcHQnO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCB0eXBlKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnROYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpIHx8ICd0ZXh0L2NzcycpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChfaW5zcGVjdDUoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdpZHRoID0gc3RhcnRUYWcubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgIHZhciBzaXplID0gby5zaXplKCk7XG4gICAgICAgICAgICAgIHdpZHRoICs9IHNpemUud2lkdGg7XG4gICAgICAgICAgICAgIHJldHVybiB3aWR0aCA+IDYwIHx8IG8uaGVpZ2h0ID4gMTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAobXVsdGlwbGVMaW5lcykge1xuICAgICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuXG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5pKCkuYmxvY2soaW5zcGVjdGVkQ2hpbGQpLm5sKCk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIG91dHB1dC5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvdXRwdXQuYXBwZW5kKGluc3BlY3RlZENoaWxkKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhlbGVtZW50KSwgJ2h0bWwnKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG5cbiAgICAgIGRpZmZMaW1pdDogNTEyLFxuICAgICAgZGlmZjogZnVuY3Rpb24gZGlmZihhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIF9kaWZmNiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KGFjdHVhbCk7XG4gICAgICAgIG91dHB1dC5pbmxpbmUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpID4gdGhpcy5kaWZmTGltaXQpIHtcbiAgICAgICAgICBvdXRwdXQuanNDb21tZW50KCdEaWZmIHN1cHByZXNzZWQgZHVlIHRvIHNpemUgPiAnICsgdGhpcy5kaWZmTGltaXQpO1xuICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZW1wdHlFbGVtZW50cyA9IGFjdHVhbC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCAmJiBleHBlY3RlZC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgdmFyIGNvbmZsaWN0aW5nRWxlbWVudCA9IGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIHx8ICFlcXVhbChnZXRBdHRyaWJ1dGVzKGFjdHVhbCksIGdldEF0dHJpYnV0ZXMoZXhwZWN0ZWQpKTtcblxuICAgICAgICBpZiAoY29uZmxpY3RpbmdFbGVtZW50KSB7XG4gICAgICAgICAgdmFyIGNhbkNvbnRpbnVlTGluZSA9IHRydWU7XG4gICAgICAgICAgb3V0cHV0LnByaXNtUHVuY3R1YXRpb24oJzwnKS5wcmlzbVRhZyhhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgaWYgKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0LmVycm9yKCdzaG91bGQgYmUnKS5zcCgpLnByaXNtVGFnKGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgYWN0dWFsQXR0cmlidXRlcyA9IGdldEF0dHJpYnV0ZXMoYWN0dWFsKTtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhleHBlY3RlZCk7XG4gICAgICAgICAgT2JqZWN0LmtleXMoYWN0dWFsQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgYWN0dWFsLm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4ob3V0cHV0LCBhdHRyaWJ1dGVOYW1lLCBhY3R1YWxBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZU5hbWUgaW4gZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgIGlmIChhY3R1YWxBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID09PSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0pIHtcbiAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0LmVycm9yKCdzaG91bGQgZXF1YWwnKS5zcCgpLmFwcGVuZChpbnNwZWN0KGVudGl0aWZ5KGV4cGVjdGVkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkpKTtcbiAgICAgICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvdXRwdXQuZXJyb3IoJ3Nob3VsZCBiZSByZW1vdmVkJyk7XG4gICAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgYWN0dWFsLm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICBvdXRwdXQuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmVycm9yKCdtaXNzaW5nJykuc3AoKTtcbiAgICAgICAgICAgICAgd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIG91dHB1dC5wcmlzbVB1bmN0dWF0aW9uKCc+Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5U3RhcnRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW1wdHlFbGVtZW50cykge1xuICAgICAgICAgIG91dHB1dC5ubCgpLmluZGVudExpbmVzKCkuaSgpLmJsb2NrKF9kaWZmNihtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChhY3R1YWwuY2hpbGROb2RlcyksIG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KGV4cGVjdGVkLmNoaWxkTm9kZXMpKSkubmwoKS5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhhY3R1YWwpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIGhhdmUgKGNsYXNzfGNsYXNzZXMpIDxhcnJheXxzdHJpbmc+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIGhhdmUgYXR0cmlidXRlcycsIHsgY2xhc3M6IHZhbHVlIH0pO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIG9ubHkgaGF2ZSAoY2xhc3N8Y2xhc3NlcykgPGFycmF5fHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywge1xuICAgICAgICBjbGFzczogZXhwZWN0Lml0KGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgICB2YXIgYWN0dWFsQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdmFsdWUgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBlY3QoYWN0dWFsQ2xhc3Nlcy5zb3J0KCksICd0byBlcXVhbCcsIHZhbHVlLnNvcnQoKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oJzxET01FbGVtZW50PiBub3QgdG8gaGF2ZSAoY2xhc3N8Y2xhc3NlcykgPGFycmF5fHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywge1xuICAgICAgICBjbGFzczogZXhwZWN0Lml0KGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgICB2YXIgYWN0dWFsQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRDbGFzc2VzID0gdm9pZCAwO1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBleHBlY3RlZENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwZWN0ZWRDbGFzc2VzID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwZWN0LmFwcGx5KHVuZGVmaW5lZCwgW2FjdHVhbENsYXNzZXMsICdub3QgdG8gY29udGFpbiddLmNvbmNhdChfdG9Db25zdW1hYmxlQXJyYXkoZXhwZWN0ZWRDbGFzc2VzKSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTVRleHROb2RlPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3Qubm9kZVZhbHVlLCAndG8gZXF1YWwnLCB2YWx1ZS5ub2RlVmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUNvbW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPERPTUNvbW1lbnQ+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5ub2RlVmFsdWUsICd0byBlcXVhbCcsIHZhbHVlLm5vZGVWYWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBBdm9pZCByZW5kZXJpbmcgYSBodWdlIG9iamVjdCBkaWZmIHdoZW4gYSB0ZXh0IG5vZGUgaXMgbWF0Y2hlZCBhZ2FpbnN0IGEgZGlmZmVyZW50IG5vZGUgdHlwZTpcbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NVGV4dE5vZGU+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPG9iamVjdD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdC5mYWlsKCk7XG4gICAgfSk7XG5cbiAgICAvLyBBbHdheXMgcGFzc2VzOlxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oXG4gICAgLy8gTmFtZSBlYWNoIHN1YmplY3QgdHlwZSB0byBpbmNyZWFzZSB0aGUgc3BlY2lmaWNpdHkgb2YgdGhlIGFzc2VydGlvblxuICAgICc8RE9NQ29tbWVudHxET01FbGVtZW50fERPTVRleHROb2RlfERPTURvY3VtZW50fEhUTUxEb2NUeXBlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01JZ25vcmVDb21tZW50PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7fSk7XG5cbiAgICAvLyBOZWNlc3NhcnkgYmVjYXVzZSB0aGlzIGNhc2Ugd291bGQgb3RoZXJ3aXNlIGJlIGhhbmRsZWQgYnkgdGhlIGFib3ZlIGNhdGNoLWFsbCBmb3IgPG9iamVjdD46XG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTVRleHROb2RlPiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxyZWdleHA+JywgZnVuY3Rpb24gKGV4cGVjdCwgX3JlZiwgdmFsdWUpIHtcbiAgICAgIHZhciBub2RlVmFsdWUgPSBfcmVmLm5vZGVWYWx1ZTtcbiAgICAgIHJldHVybiBleHBlY3Qobm9kZVZhbHVlLCAndG8gc2F0aXNmeScsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oJzxET01UZXh0Tm9kZT4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8YW55PicsIGZ1bmN0aW9uIChleHBlY3QsIF9yZWYyLCB2YWx1ZSkge1xuICAgICAgdmFyIG5vZGVWYWx1ZSA9IF9yZWYyLm5vZGVWYWx1ZTtcbiAgICAgIHJldHVybiBleHBlY3Qobm9kZVZhbHVlLCAndG8gc2F0aXNmeScsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhub2RlLCBpc0h0bWwpIHtcbiAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSAxMCkge1xuICAgICAgICAvLyBIVE1MRG9jVHlwZVxuICAgICAgICByZXR1cm4geyBuYW1lOiBub2RlLm5vZGVOYW1lIH07XG4gICAgICB9IGVsc2UgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEpIHtcbiAgICAgICAgLy8gRE9NRWxlbWVudFxuICAgICAgICB2YXIgbmFtZSA9IGlzSHRtbCA/IG5vZGUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IG5vZGUubm9kZU5hbWU7XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IHsgbmFtZTogbmFtZSB9O1xuXG4gICAgICAgIGlmIChub2RlLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICByZXN1bHQuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5hdHRyaWJ1dGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICByZXN1bHQuYXR0cmlidXRlc1tub2RlLmF0dHJpYnV0ZXNbaV0ubmFtZV0gPSBpc0h0bWwgJiYgaXNCb29sZWFuQXR0cmlidXRlKG5vZGUuYXR0cmlidXRlc1tpXS5uYW1lKSA/IHRydWUgOiBub2RlLmF0dHJpYnV0ZXNbaV0udmFsdWUgfHwgJyc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChub2RlLmNoaWxkTm9kZXMsIGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGVsc2UgaWYgKG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgLy8gRE9NVGV4dE5vZGVcbiAgICAgICAgcmV0dXJuIG5vZGUubm9kZVZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSA4KSB7XG4gICAgICAgIC8vIERPTUNvbW1lbnRcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RvIHNhdGlzZnk6IE5vZGUgdHlwZSAnICsgbm9kZS5ub2RlVHlwZSArICcgaXMgbm90IHlldCBzdXBwb3J0ZWQgaW4gdGhlIHZhbHVlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTU5vZGVMaXN0PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxzdHJpbmc+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcblxuICAgICAgZXhwZWN0LmFyZ3NPdXRwdXQgPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZSh2YWx1ZSwgaXNIdG1sID8gJ2h0bWwnIDogJ3htbCcpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIChpc0h0bWwgPyBwYXJzZUh0bWwodmFsdWUsIHRydWUpIDogcGFyc2VYbWwodmFsdWUpKS5jaGlsZE5vZGVzKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oJzxET01Ob2RlTGlzdD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NTm9kZUxpc3Q+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgIHZhciBzYXRpc2Z5U3BlY3MgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgc2F0aXNmeVNwZWNzLnB1c2goY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlW2ldLCBpc0h0bWwpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBzYXRpc2Z5U3BlY3MpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTURvY3VtZW50RnJhZ21lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuXG4gICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKHZhbHVlLCBpc0h0bWwgPyAnaHRtbCcgOiAneG1sJyk7XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgaXNIdG1sID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlKSA6IHBhcnNlWG1sKHZhbHVlKSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRG9jdW1lbnRGcmFnbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NRG9jdW1lbnRGcmFnbWVudD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBfcmVmMykge1xuICAgICAgdmFyIGNoaWxkTm9kZXMgPSBfcmVmMy5jaGlsZE5vZGVzO1xuXG4gICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGNoaWxkTm9kZXMsIGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRG9jdW1lbnRGcmFnbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8b2JqZWN0fGFycmF5PicsIGZ1bmN0aW9uIChleHBlY3QsIF9yZWY0LCB2YWx1ZSkge1xuICAgICAgdmFyIGNoaWxkTm9kZXMgPSBfcmVmNC5jaGlsZE5vZGVzO1xuICAgICAgcmV0dXJuIGV4cGVjdChjaGlsZE5vZGVzLCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oJzxET01FbGVtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxzdHJpbmc+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0KTtcbiAgICAgIHZhciBkb2N1bWVudEZyYWdtZW50ID0gaXNIdG1sID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlKSA6IHBhcnNlWG1sKHZhbHVlKTtcbiAgICAgIGlmIChkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSFRNTEVsZW1lbnQgdG8gc2F0aXNmeSBzdHJpbmc6IE9ubHkgYSBzaW5nbGUgbm9kZSBpcyBzdXBwb3J0ZWQnKTtcbiAgICAgIH1cblxuICAgICAgZXhwZWN0LmFyZ3NPdXRwdXQgPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZSh2YWx1ZSwgaXNIdG1sID8gJ2h0bWwnIDogJ3htbCcpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2Rlc1swXSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRG9jdW1lbnQ+IHRvIFtleGhhdXN0aXZlbHldIHNhdGlzZnkgPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpO1xuICAgICAgdmFyIHZhbHVlRG9jdW1lbnQgPSBpc0h0bWwgPyBwYXJzZUh0bWwodmFsdWUsIGZhbHNlKSA6IHBhcnNlWG1sKHZhbHVlKTtcbiAgICAgIHJldHVybiBleHBlY3QobWFrZUF0dGFjaGVkRE9NTm9kZUxpc3Qoc3ViamVjdC5jaGlsZE5vZGVzKSwgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodmFsdWVEb2N1bWVudC5jaGlsZE5vZGVzLCBmdW5jdGlvbiAoY2hpbGROb2RlKSB7XG4gICAgICAgIHJldHVybiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMoY2hpbGROb2RlLCBpc0h0bWwpO1xuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTURvY3VtZW50PiB0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5IDxET01Eb2N1bWVudD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBfcmVmNSkge1xuICAgICAgdmFyIGNoaWxkTm9kZXMgPSBfcmVmNS5jaGlsZE5vZGVzO1xuXG4gICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICByZXR1cm4gZXhwZWN0KG1ha2VBdHRhY2hlZERPTU5vZGVMaXN0KHN1YmplY3QuY2hpbGROb2RlcyksICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGNoaWxkTm9kZXMsIGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NRWxlbWVudD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyh2YWx1ZSwgaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCkpKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oWyc8RE9NRWxlbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NVGV4dE5vZGU+JywgJzxET01UZXh0Tm9kZT4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8RE9NRWxlbWVudD4nLCAnPERPTUVsZW1lbnR8RE9NRG9jdW1lbnRGcmFnbWVudHxET01Eb2N1bWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8cmVnZXhwPiddLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdC5mYWlsKCk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeSA8b2JqZWN0PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoc3ViamVjdCk7XG4gICAgICBlbnN1cmVTdXBwb3J0ZWRTcGVjT3B0aW9ucyh2YWx1ZSk7XG5cbiAgICAgIHZhciBwcm9taXNlQnlLZXkgPSB7XG4gICAgICAgIG5hbWU6IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLm5hbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWUsICd0byBzYXRpc2Z5JywgdmFsdWUubmFtZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBjaGlsZHJlbjogZXhwZWN0LnByb21pc2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUuY2hpbGRyZW4gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlLnRleHRDb250ZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBjaGlsZHJlbiBhbmQgdGV4dENvbnRlbnQgcHJvcGVydGllcyBhcmUgbm90IHN1cHBvcnRlZCB0b2dldGhlcicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY29udGVudFR5cGUgPSBzdWJqZWN0Lm93bmVyRG9jdW1lbnQuY29udGVudFR5cGU7XG4gICAgICAgICAgICBpZiAoIWNvbnRlbnRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIHByb3ZpZGUgYSB2YWx1ZSBpbiB0aGUgYWJzZW5jZSBvZiBhIGNvbnRlbnRUeXBlIChJRTExKVxuICAgICAgICAgICAgICBjb250ZW50VHlwZSA9IGlzSW5zaWRlSHRtbERvY3VtZW50KHN1YmplY3QpID8gJ3RleHQvaHRtbCcgOiAnYXBwbGljYXRpb24veG1sJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdChtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChzdWJqZWN0LmNoaWxkTm9kZXMsIGNvbnRlbnRUeXBlKSwgJ3RvIHNhdGlzZnknLCB2YWx1ZS5jaGlsZHJlbik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZS50ZXh0Q29udGVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC50ZXh0Q29udGVudCwgJ3RvIHNhdGlzZnknLCB2YWx1ZS50ZXh0Q29udGVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBhdHRyaWJ1dGVzOiB7fVxuICAgICAgfTtcblxuICAgICAgdmFyIG9ubHlBdHRyaWJ1dGVzID0gdmFsdWUgJiYgdmFsdWUub25seUF0dHJpYnV0ZXMgfHwgZXhwZWN0LmZsYWdzLmV4aGF1c3RpdmVseTtcbiAgICAgIHZhciBhdHRycyA9IGdldEF0dHJpYnV0ZXMoc3ViamVjdCk7XG4gICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gdmFsdWUgJiYgdmFsdWUuYXR0cmlidXRlcztcbiAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzID0gW107XG4gICAgICB2YXIgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSA9IHt9O1xuXG4gICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gW2V4cGVjdGVkQXR0cmlidXRlc107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID0gdHJ1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZEF0dHJpYnV0ZXMgJiYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGV4cGVjdGVkQXR0cmlidXRlcykpID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUgPSBleHBlY3RlZEF0dHJpYnV0ZXM7XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmtleXMoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSkuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMucHVzaChhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgdmFyIGF0dHJpYnV0ZVZhbHVlID0gc3ViamVjdC5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUgPSBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gZXhwZWN0LnByb21pc2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksICd0byBiZSBmYWxzZScpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNFbnVtZXJhdGVkQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgIHZhciBpbmRleE9mRW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlID0gZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlc1thdHRyaWJ1dGVOYW1lXS5pbmRleE9mKGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpO1xuXG4gICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4T2ZFbnVtZXJhdGVkQXR0cmlidXRlVmFsdWUgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICBleHBlY3QuZmFpbChmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnSW52YWxpZCBleHBlY3RlZCB2YWx1ZSAnKS5hcHBlbmRJbnNwZWN0ZWQoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSkudGV4dCgnLiBTdXBwb3J0ZWQgdmFsdWVzIGluY2x1ZGU6ICcpLmFwcGVuZEl0ZW1zKGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXNbYXR0cmlidXRlTmFtZV0sICcsICcpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZXhwZWN0KGF0dHJpYnV0ZVZhbHVlLCAndG8gc2F0aXNmeScsIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksICd0byBiZSB0cnVlJyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnICYmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gJ3N0cmluZycgfHwgQXJyYXkuaXNBcnJheShleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKSkpIHtcbiAgICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkQ2xhc3NlcyA9IGV4cGVjdGVkQXR0cmlidXRlVmFsdWU7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRDbGFzc2VzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3QoYWN0dWFsQ2xhc3Nlcy5zb3J0KCksICd0byBlcXVhbCcsIGV4cGVjdGVkQ2xhc3Nlcy5zb3J0KCkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChleHBlY3RlZENsYXNzZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KGV4cGVjdGVkQ2xhc3NlcywgJ3RvIGJlIGVtcHR5Jyk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1YmJsZUVycm9yKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3QuYXBwbHkodW5kZWZpbmVkLCBbYWN0dWFsQ2xhc3NlcywgJ3RvIGNvbnRhaW4nXS5jb25jYXQoX3RvQ29uc3VtYWJsZUFycmF5KGV4cGVjdGVkQ2xhc3NlcykpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgIHZhciBleHBlY3RlZFN0eWxlT2JqID0gdm9pZCAwO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFsaWRhdGVTdHlsZXMoZXhwZWN0LCBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlKTtcbiAgICAgICAgICAgICAgICBleHBlY3RlZFN0eWxlT2JqID0gc3R5bGVTdHJpbmdUb09iamVjdChleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZFN0eWxlT2JqID0gZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0KGF0dHJzLnN0eWxlLCAndG8gZXhoYXVzdGl2ZWx5IHNhdGlzZnknLCBleHBlY3RlZFN0eWxlT2JqKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdChhdHRycy5zdHlsZSwgJ3RvIHNhdGlzZnknLCBleHBlY3RlZFN0eWxlT2JqKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChleHBlY3QuZmluZFR5cGVPZihleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKS5pcygnZXhwZWN0Lml0JykpIHtcbiAgICAgICAgICAgICAgZXhwZWN0LmNvbnRleHQudGhpc09iamVjdCA9IHN1YmplY3Q7XG4gICAgICAgICAgICAgIHJldHVybiBidWJibGVFcnJvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUoYXR0cmlidXRlVmFsdWUsIGV4cGVjdC5jb250ZXh0KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gYnViYmxlRXJyb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3QoYXR0cmlidXRlVmFsdWUsICd0byBzYXRpc2Z5JywgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBwcm9taXNlQnlLZXkuYXR0cmlidXRlUHJlc2VuY2UgPSBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZCA9IFtdO1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBleHBlY3QoYXR0cnMsICdub3QgdG8gaGF2ZSBrZXknLCBhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5wdXNoKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICBleHBlY3QoYXR0cnMsICd0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgZXhwZWN0KE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCksICd0byBlcXVhbCcsIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5zb3J0KCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHBlY3QucHJvbWlzZS5hbGwocHJvbWlzZUJ5S2V5KS5jYXVnaHQoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZXhwZWN0LnByb21pc2Uuc2V0dGxlKHByb21pc2VCeUtleSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoe1xuICAgICAgICAgICAgZGlmZjogZnVuY3Rpb24gZGlmZihvdXRwdXQsIF9kaWZmNywgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmJsb2NrKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VlbkVycm9yID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnByaXNtUHVuY3R1YXRpb24oJzwnKS5wcmlzbVRhZyhpc0h0bWwgPyBzdWJqZWN0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBzdWJqZWN0Lm5vZGVOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvbWlzZUJ5S2V5Lm5hbWUuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgICBzZWVuRXJyb3IgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgdmFyIG5hbWVFcnJvciA9IHByb21pc2VCeUtleS5uYW1lLnJlYXNvbigpO1xuICAgICAgICAgICAgICAgICAgb3V0cHV0LnNwKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dC5lcnJvcihuYW1lRXJyb3IgJiYgbmFtZUVycm9yLmdldExhYmVsKCkgfHwgJ3Nob3VsZCBzYXRpc2Z5Jykuc3AoKS5hcHBlbmQoaW5zcGVjdCh2YWx1ZS5uYW1lKSk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGluc3BlY3RlZEF0dHJpYnV0ZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZU91dHB1dCA9IG91dHB1dC5jbG9uZSgpO1xuICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihhdHRyaWJ1dGVPdXRwdXQsIGF0dHJpYnV0ZU5hbWUsIGF0dHJzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgICAgICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS5pc0Z1bGZpbGxlZCgpIHx8ICFwcm9taXNlICYmICghb25seUF0dHJpYnV0ZXMgfHwgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpICE9PSAtMSkpIHt9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZWVuRXJyb3IgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVPdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LmFwcGVuZEVycm9yTWVzc2FnZShwcm9taXNlLnJlYXNvbigpKTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seUF0dHJpYnV0ZXMgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5lcnJvcignc2hvdWxkIGJlIHJlbW92ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaW5zcGVjdGVkQXR0cmlidXRlcy5wdXNoKGF0dHJpYnV0ZU91dHB1dCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIXN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghcHJvbWlzZSB8fCBwcm9taXNlLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHNlZW5FcnJvciA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHByb21pc2UgJiYgcHJvbWlzZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlT3V0cHV0ID0gb3V0cHV0LmNsb25lKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5lcnJvcignbWlzc2luZycpLnNwKCkucHJpc21BdHRyTmFtZShhdHRyaWJ1dGVOYW1lLCAnaHRtbCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LnNwKCkuZXJyb3IoZXJyICYmIGVyci5nZXRMYWJlbCgpIHx8ICdzaG91bGQgc2F0aXNmeScpLnNwKCkuYXBwZW5kKGluc3BlY3QoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGluc3BlY3RlZEF0dHJpYnV0ZXMucHVzaChhdHRyaWJ1dGVPdXRwdXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGluc3BlY3RlZEF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgaWYgKHNlZW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpLmluZGVudCgpLmJsb2NrKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBpbnNwZWN0ZWRBdHRyaWJ1dGVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQubmwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pLm91dGRlbnRMaW5lcygpLm5sKCk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKTtcbiAgICAgICAgICAgICAgICAgICAgaW5zcGVjdGVkQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtLCBpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0LmFwcGVuZChpdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZWVuRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgIC8vIFRoZSB0YWcgbmFtZSBtaXNtYXRjaGVkXG4gICAgICAgICAgICAgICAgICBvdXRwdXQubmwoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPicpO1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZHJlbkVycm9yID0gcHJvbWlzZUJ5S2V5LmNoaWxkcmVuLmlzUmVqZWN0ZWQoKSAmJiBwcm9taXNlQnlLZXkuY2hpbGRyZW4ucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBjaGlsZHJlbkRpZmYgPSBjaGlsZHJlbkVycm9yLmdldERpZmYob3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbkRpZmYgJiYgY2hpbGRyZW5EaWZmLmlubGluZSkge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpLmkoKS5ibG9jayhjaGlsZHJlbkRpZmYpLm5sKCkub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpLmkoKS5ibG9jayhmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJqZWN0LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKS5ubCgpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dC5hcHBlbmRFcnJvck1lc3NhZ2UoY2hpbGRyZW5FcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQubmwoKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJqZWN0LmNoaWxkTm9kZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0KHN1YmplY3QuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoc3ViamVjdCksICdodG1sJyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBvdXRwdXQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oJzxET01FbGVtZW50PiB0byBbb25seV0gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpIDxzdHJpbmcrPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QpIHtcbiAgICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDIgPyBfbGVuIC0gMiA6IDApLCBfa2V5ID0gMjsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgICAgICBhcmdzW19rZXkgLSAyXSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gW29ubHldIGhhdmUgYXR0cmlidXRlcycsIGFyZ3MpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IG5vdCB0byBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcykgPGFycmF5PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgYXR0cmlidXRlcyA9IGdldEF0dHJpYnV0ZXMoc3ViamVjdCk7XG5cbiAgICAgIHZhbHVlLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIGF0dHJpYnV0ZXNbbmFtZV07XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gb25seSBoYXZlIGF0dHJpYnV0ZXMnLCBhdHRyaWJ1dGVzKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5leHBvcnRBc3NlcnRpb24oJzxET01FbGVtZW50PiBub3QgdG8gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpIDxzdHJpbmcrPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QpIHtcbiAgICAgIGZvciAodmFyIF9sZW4yID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4yID4gMiA/IF9sZW4yIC0gMiA6IDApLCBfa2V5MiA9IDI7IF9rZXkyIDwgX2xlbjI7IF9rZXkyKyspIHtcbiAgICAgICAgYXJnc1tfa2V5MiAtIDJdID0gYXJndW1lbnRzW19rZXkyXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAnbm90IHRvIGhhdmUgYXR0cmlidXRlcycsIGFyZ3MpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTUVsZW1lbnQ+IHRvIFtvbmx5XSBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcykgPGFycmF5fG9iamVjdD4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gc2F0aXNmeScsIHtcbiAgICAgICAgYXR0cmlidXRlczogdmFsdWUsXG4gICAgICAgIG9ubHlBdHRyaWJ1dGVzOiBleHBlY3QuZmxhZ3Mub25seVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gaGF2ZSBbbm9dIChjaGlsZHxjaGlsZHJlbiknLCBmdW5jdGlvbiAoZXhwZWN0LCBfcmVmNikge1xuICAgICAgdmFyIGNoaWxkTm9kZXMgPSBfcmVmNi5jaGlsZE5vZGVzO1xuICAgICAgcmV0dXJuIGV4cGVjdC5mbGFncy5ubyA/IGV4cGVjdChjaGlsZE5vZGVzLCAndG8gYmUgZW1wdHknKSA6IGV4cGVjdChjaGlsZE5vZGVzLCAnbm90IHRvIGJlIGVtcHR5Jyk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRWxlbWVudD4gdG8gaGF2ZSB0ZXh0IDxhbnk+JywgZnVuY3Rpb24gKGV4cGVjdCwgX3JlZjcsIHZhbHVlKSB7XG4gICAgICB2YXIgdGV4dENvbnRlbnQgPSBfcmVmNy50ZXh0Q29udGVudDtcbiAgICAgIHJldHVybiBleHBlY3QodGV4dENvbnRlbnQsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPERPTURvY3VtZW50fERPTUVsZW1lbnR8RE9NRG9jdW1lbnRGcmFnbWVudD4gW3doZW5dIHF1ZXJpZWQgZm9yIFtmaXJzdF0gPHN0cmluZz4gPGFzc2VydGlvbj8+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgcXVlcnkpIHtcbiAgICAgIHZhciBxdWVyeVJlc3VsdCA9IHZvaWQgMDtcblxuICAgICAgZXhwZWN0LmFyZ3NPdXRwdXRbMF0gPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuZ3JlZW4ocXVlcnkpO1xuICAgICAgfTtcbiAgICAgIGV4cGVjdC5lcnJvck1vZGUgPSAnbmVzdGVkJztcblxuICAgICAgaWYgKGV4cGVjdC5mbGFncy5maXJzdCkge1xuICAgICAgICBxdWVyeVJlc3VsdCA9IHN1YmplY3QucXVlcnlTZWxlY3RvcihxdWVyeSk7XG4gICAgICAgIGlmICghcXVlcnlSZXN1bHQpIHtcbiAgICAgICAgICBleHBlY3Quc3ViamVjdE91dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBlY3QuaW5zcGVjdChzdWJqZWN0LCBJbmZpbml0eSwgb3V0cHV0KTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgZXhwZWN0LmZhaWwoZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyhxdWVyeSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KTtcbiAgICAgICAgaWYgKHF1ZXJ5UmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGV4cGVjdC5zdWJqZWN0T3V0cHV0ID0gZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgcmV0dXJuIGV4cGVjdC5pbnNwZWN0KHN1YmplY3QsIEluZmluaXR5LCBvdXRwdXQpO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBleHBlY3QuZmFpbChmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0LmVycm9yKCdUaGUgc2VsZWN0b3InKS5zcCgpLmpzU3RyaW5nKHF1ZXJ5KS5zcCgpLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cGVjdC5zaGlmdChxdWVyeVJlc3VsdCk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiB0byBjb250YWluIFtub10gZWxlbWVudHMgbWF0Y2hpbmcgPHN0cmluZz4nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSkge1xuICAgICAgaWYgKGV4cGVjdC5mbGFncy5ubykge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QucXVlcnlTZWxlY3RvckFsbChxdWVyeSksICd0byBzYXRpc2Z5JywgW10pO1xuICAgICAgfVxuXG4gICAgICBleHBlY3Quc3ViamVjdE91dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdC5pbnNwZWN0KHN1YmplY3QsIEluZmluaXR5LCBvdXRwdXQpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpLCAnbm90IHRvIHNhdGlzZnknLCBbXSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50PiBbbm90XSB0byBtYXRjaCA8c3RyaW5nPicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHF1ZXJ5KSB7XG4gICAgICBleHBlY3Quc3ViamVjdE91dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdC5pbnNwZWN0KHN1YmplY3QsIEluZmluaXR5LCBvdXRwdXQpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIGV4cGVjdChtYXRjaGVzU2VsZWN0b3Ioc3ViamVjdCwgcXVlcnkpLCAnW25vdF0gdG8gYmUgdHJ1ZScpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPHN0cmluZz4gW3doZW5dIHBhcnNlZCBhcyAoaHRtbHxIVE1MKSBbZnJhZ21lbnRdIDxhc3NlcnRpb24/PicsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QpIHtcbiAgICAgIGV4cGVjdC5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgIHJldHVybiBleHBlY3Quc2hpZnQocGFyc2VIdG1sKHN1YmplY3QsIGV4cGVjdC5mbGFncy5mcmFnbWVudCkpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmV4cG9ydEFzc2VydGlvbignPHN0cmluZz4gW3doZW5dIHBhcnNlZCBhcyAoeG1sfFhNTCkgPGFzc2VydGlvbj8+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgZXhwZWN0LmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgcmV0dXJuIGV4cGVjdC5zaGlmdChwYXJzZVhtbChzdWJqZWN0KSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBzY29yZUVsZW1lbnRBZ2FpbnN0U3BlYyhlbGVtZW50LCBzcGVjKSB7XG4gICAgICB2YXIgaXNUZXh0U2ltaWxhciA9IGZ1bmN0aW9uIGlzVGV4dFNpbWlsYXIodmFsdWUsIHZhbHVlU3BlYykge1xuICAgICAgICB2YXIgYWN0dWFsID0gKHZhbHVlIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZVNwZWMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgaWYgKGFjdHVhbCA9PT0gdmFsdWVTcGVjLnRyaW0oKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWVTcGVjIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgaWYgKHZhbHVlU3BlYy50ZXN0KGFjdHVhbCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWVTcGVjID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9O1xuXG4gICAgICB2YXIgaXNIdG1sID0gaXNJbnNpZGVIdG1sRG9jdW1lbnQoZWxlbWVudCk7XG5cbiAgICAgIHZhciBzY29yZSA9IDA7XG5cbiAgICAgIHZhciBub2RlTmFtZSA9IGlzSHRtbCA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG5cbiAgICAgIGlmIChpc1RleHRTaW1pbGFyKG5vZGVOYW1lLCBzcGVjLm5hbWUpKSB7XG4gICAgICAgIHNjb3JlKys7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc1RleHRTaW1pbGFyKGVsZW1lbnQudGV4dENvbnRlbnQsIHNwZWMudGV4dENvbnRlbnQpKSB7XG4gICAgICAgIHNjb3JlKys7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgZWxlbWVudC5oYXNBdHRyaWJ1dGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdmFyIGF0dHJpYnV0ZXMgPSBzcGVjLmF0dHJpYnV0ZXMgfHwge307XG4gICAgICAgIHZhciBjbGFzc05hbWUgPSBhdHRyaWJ1dGVzWydjbGFzcyddO1xuICAgICAgICB2YXIgc3R5bGUgPSBhdHRyaWJ1dGVzLnN0eWxlO1xuXG4gICAgICAgIGlmIChjbGFzc05hbWUgJiYgZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2NsYXNzJykpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGNsYXNzTmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhciBleHBlY3RlZENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB2YXIgYWN0dWFsQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2NsYXNzJykpO1xuXG4gICAgICAgICAgICBleHBlY3RlZENsYXNzZXMuZm9yRWFjaChmdW5jdGlvbiAoZXhwZWN0ZWRDbGFzcykge1xuICAgICAgICAgICAgICBpZiAoYWN0dWFsQ2xhc3Nlcy5pbmRleE9mKGV4cGVjdGVkQ2xhc3MpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHNjb3JlKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXNUZXh0U2ltaWxhcihlbGVtZW50LmdldEF0dHJpYnV0ZSgnY2xhc3MnKSwgY2xhc3NOYW1lKSkge1xuICAgICAgICAgICAgc2NvcmUrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3R5bGUgJiYgZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ3N0eWxlJykpIHtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRTdHlsZXMgPSB0eXBlb2Ygc3R5bGUgPT09ICdzdHJpbmcnID8gc3R5bGVTdHJpbmdUb09iamVjdChzdHlsZSkgOiBzdHlsZTtcbiAgICAgICAgICB2YXIgYWN0dWFsU3R5bGVzID0gc3R5bGVTdHJpbmdUb09iamVjdChlbGVtZW50LmdldEF0dHJpYnV0ZSgnc3R5bGUnKSk7XG5cbiAgICAgICAgICBPYmplY3Qua2V5cyhleHBlY3RlZFN0eWxlcykuZm9yRWFjaChmdW5jdGlvbiAoc3R5bGVOYW1lKSB7XG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRTdHlsZSA9IGV4cGVjdGVkU3R5bGVzW3N0eWxlTmFtZV07XG4gICAgICAgICAgICB2YXIgYWN0dWFsU3R5bGUgPSBhY3R1YWxTdHlsZXNbc3R5bGVOYW1lXTtcblxuICAgICAgICAgICAgaWYgKGFjdHVhbFN0eWxlKSB7XG4gICAgICAgICAgICAgIHNjb3JlKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc1RleHRTaW1pbGFyKGFjdHVhbFN0eWxlLCBleHBlY3RlZFN0eWxlKSkge1xuICAgICAgICAgICAgICBzY29yZSsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNwZWNpYWxBdHRyaWJ1dGVzID0gWydzdHlsZScsICdjbGFzcyddO1xuICAgICAgICB2YXIgaWRzID0gWydpZCcsICdkYXRhLXRlc3QtaWQnLCAnZGF0YS10ZXN0aWQnXTtcblxuICAgICAgICBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgaWYgKHNwZWNpYWxBdHRyaWJ1dGVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIHNraXBcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgIHNjb3JlKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSA9PT0gYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkge1xuICAgICAgICAgICAgICBzY29yZSArPSBpZHMuaW5kZXhPZihhdHRyaWJ1dGVOYW1lKSA9PT0gLTEgPyAxIDogMTAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzY29yZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHZhciBleHBlY3RlZENoaWxkcmVuID0gc3BlYy5jaGlsZHJlbiB8fCBbXTtcblxuICAgICAgZXhwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChjaGlsZFNwZWMsIGkpIHtcbiAgICAgICAgdmFyIGNoaWxkID0gZWxlbWVudC5jaGlsZE5vZGVzW2ldO1xuICAgICAgICB2YXIgY2hpbGRUeXBlID0gZXhwZWN0LmZpbmRUeXBlT2YoY2hpbGQpO1xuXG4gICAgICAgIGlmICghY2hpbGQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGNoaWxkU3BlYy5ub2RlVHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBpZiAoY2hpbGQubm9kZVR5cGUgPT09IGNoaWxkU3BlYy5ub2RlVHlwZSkge1xuICAgICAgICAgICAgaWYgKGNoaWxkVHlwZS5pcygnRE9NRWxlbWVudCcpKSB7XG4gICAgICAgICAgICAgIC8vIEVsZW1lbnRcbiAgICAgICAgICAgICAgc2NvcmUgKz0gc2NvcmVFbGVtZW50QWdhaW5zdFNwZWMoZWxlbWVudC5jaGlsZE5vZGVzW2ldLCBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMoY2hpbGRTcGVjKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3JlKys7XG4gICAgICAgICAgfSBlbHNlIGlmIChleHBlY3QuZmluZFR5cGVPZihjaGlsZFNwZWMpLmlzKCdET01JZ25vcmVDb21tZW50JykpIHtcbiAgICAgICAgICAgIHNjb3JlKys7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkVHlwZS5pcygnRE9NRWxlbWVudCcpICYmICh0eXBlb2YgY2hpbGRTcGVjID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihjaGlsZFNwZWMpKSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBzY29yZSArPSBzY29yZUVsZW1lbnRBZ2FpbnN0U3BlYyhlbGVtZW50LmNoaWxkTm9kZXNbaV0sIGNoaWxkU3BlYyk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGRUeXBlLmlzKCdET01UZXh0Tm9kZScpICYmIGlzVGV4dFNpbWlsYXIoY2hpbGQubm9kZVZhbHVlLCBjaGlsZFNwZWMpKSB7XG4gICAgICAgICAgc2NvcmUrKztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBzY29yZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaW5kTWF0Y2hlc1dpdGhHb29kU2NvcmUoZGF0YSwgc3BlYykge1xuICAgICAgdmFyIGVsZW1lbnRzID0gdHlwZW9mIGRhdGEubGVuZ3RoID09PSAnbnVtYmVyJyA/IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpIDogW2RhdGFdO1xuXG4gICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICB2YXIgYmVzdFNjb3JlID0gMDtcblxuICAgICAgZWxlbWVudHMuZm9yRWFjaChmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICB2YXIgc2NvcmUgPSBzY29yZUVsZW1lbnRBZ2FpbnN0U3BlYyhlbGVtZW50LCBzcGVjKTtcbiAgICAgICAgYmVzdFNjb3JlID0gTWF0aC5tYXgoc2NvcmUsIGJlc3RTY29yZSk7XG5cbiAgICAgICAgaWYgKHNjb3JlID4gMCAmJiBzY29yZSA+PSBiZXN0U2NvcmUpIHtcbiAgICAgICAgICByZXN1bHQucHVzaCh7IHNjb3JlOiBzY29yZSwgZWxlbWVudDogZWxlbWVudCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgdmFyIGNoaWxkID0gZWxlbWVudC5jaGlsZE5vZGVzW2ldO1xuICAgICAgICAgIGlmIChjaGlsZC5ub2RlVHlwZSA9PT0gMSkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2guYXBwbHkocmVzdWx0LCBfdG9Db25zdW1hYmxlQXJyYXkoZmluZE1hdGNoZXNXaXRoR29vZFNjb3JlKGNoaWxkLCBzcGVjKSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlc3VsdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBiLnNjb3JlIC0gYS5zY29yZTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzdWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIF9iZXN0U2NvcmUgPSByZXN1bHRbMF0uc2NvcmU7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24gKF9yZWY4KSB7XG4gICAgICAgICAgdmFyIHNjb3JlID0gX3JlZjguc2NvcmU7XG4gICAgICAgICAgcmV0dXJuIHNjb3JlID09PSBfYmVzdFNjb3JlO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBleHBlY3QuZXhwb3J0QXNzZXJ0aW9uKCc8RE9NRG9jdW1lbnR8RE9NRWxlbWVudHxET01Eb2N1bWVudEZyYWdtZW50fERPTU5vZGVMaXN0PiBbbm90XSB0byBjb250YWluIDxET01FbGVtZW50fG9iamVjdHxzdHJpbmc+JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBub2RlcyA9IHN1YmplY3QuY2hpbGROb2RlcyB8fCBtYWtlQXR0YWNoZWRET01Ob2RlTGlzdChzdWJqZWN0KTtcbiAgICAgIHZhciBpc0h0bWwgPSBpc0luc2lkZUh0bWxEb2N1bWVudChzdWJqZWN0LmNoaWxkTm9kZXMgPyBzdWJqZWN0IDogbm9kZXMpO1xuICAgICAgdmFyIHZhbHVlVHlwZSA9IGV4cGVjdC5maW5kVHlwZU9mKHZhbHVlKTtcbiAgICAgIHZhciBzcGVjID0gdmFsdWU7XG5cbiAgICAgIGlmICh2YWx1ZVR5cGUuaXMoJ0RPTUVsZW1lbnQnKSkge1xuICAgICAgICBzcGVjID0gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlLCBpc0h0bWwpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZVR5cGUuaXMoJ3N0cmluZycpKSB7XG4gICAgICAgIHZhciBkb2N1bWVudEZyYWdtZW50ID0gaXNIdG1sID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlKSA6IHBhcnNlWG1sKHZhbHVlKTtcblxuICAgICAgICBpZiAoZG9jdW1lbnRGcmFnbWVudC5jaGlsZE5vZGVzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSFRNTEVsZW1lbnQgdG8gY29udGFpbiBzdHJpbmc6IE9ubHkgYSBzaW5nbGUgbm9kZSBpcyBzdXBwb3J0ZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNwZWMgPSBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMoZG9jdW1lbnRGcmFnbWVudC5jaGlsZE5vZGVzWzBdLCBpc0h0bWwpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUxFbGVtZW50IHRvIGNvbnRhaW4gc3RyaW5nOiBwbGVhc2UgcHJvdmlkZSBhIEhUTUwgc3RydWN0dXJlIGFzIGEgc3RyaW5nJyk7XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3QuYXJnc091dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb3V0cHV0LmFwcGVuZEluc3BlY3RlZChkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXNbMF0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGVuc3VyZVN1cHBvcnRlZFNwZWNPcHRpb25zKHNwZWMpO1xuICAgICAgfVxuXG4gICAgICB2YXIgc2NvcmVkRWxlbWVudHMgPSBmaW5kTWF0Y2hlc1dpdGhHb29kU2NvcmUobm9kZXMsIHNwZWMpO1xuXG4gICAgICBpZiAoZXhwZWN0LmZsYWdzLm5vdCkge1xuICAgICAgICBpZiAoc2NvcmVkRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiBleHBlY3Qud2l0aEVycm9yKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBlY3Qoc2NvcmVkRWxlbWVudHMubWFwKGZ1bmN0aW9uIChfcmVmOSkge1xuICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9IF9yZWY5LmVsZW1lbnQ7XG4gICAgICAgICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgICAgICAgfSksICdub3QgdG8gaGF2ZSBhbiBpdGVtIHNhdGlzZnlpbmcnLCBzcGVjKTtcbiAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYmVzdE1hdGNoID0gc2NvcmVkRWxlbWVudHNbMF0uZWxlbWVudDtcblxuICAgICAgICAgICAgZXhwZWN0LnN1YmplY3RPdXRwdXQgPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICAgIHJldHVybiBleHBlY3QuaW5zcGVjdChzdWJqZWN0LCBJbmZpbml0eSwgb3V0cHV0KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGV4cGVjdC5mYWlsKHtcbiAgICAgICAgICAgICAgZGlmZjogZnVuY3Rpb24gZGlmZihvdXRwdXQsIF9kaWZmOCwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0LmVycm9yKCdGb3VuZDonKS5ubCgyKS5hcHBlbmRJbnNwZWN0ZWQoYmVzdE1hdGNoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChzY29yZWRFbGVtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBleHBlY3Quc3ViamVjdE91dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBlY3QuaW5zcGVjdChzdWJqZWN0LCBJbmZpbml0eSwgb3V0cHV0KTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIGV4cGVjdC5mYWlsKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwZWN0LndpdGhFcnJvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIGV4cGVjdChzY29yZWRFbGVtZW50cy5tYXAoZnVuY3Rpb24gKF9yZWYxMCkge1xuICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBfcmVmMTAuZWxlbWVudDtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgICAgIH0pLCAndG8gaGF2ZSBhbiBpdGVtIHNhdGlzZnlpbmcnLCBzcGVjKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBiZXN0TWF0Y2ggPSBzY29yZWRFbGVtZW50c1swXS5lbGVtZW50O1xuXG4gICAgICAgICAgcmV0dXJuIGV4cGVjdChiZXN0TWF0Y2gsICd0byBzYXRpc2Z5Jywgc3BlYyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGVsbSwgc2VsZWN0b3IpIHtcbiAgdmFyIG1hdGNoRnVudGlvbiA9IGVsbS5tYXRjaGVzU2VsZWN0b3IgfHwgZWxtLm1vek1hdGNoZXNTZWxlY3RvciB8fCBlbG0ubXNNYXRjaGVzU2VsZWN0b3IgfHwgZWxtLm9NYXRjaGVzU2VsZWN0b3IgfHwgZWxtLndlYmtpdE1hdGNoZXNTZWxlY3RvciB8fCBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXM7XG4gICAgdmFyIG5vZGVzID0gKG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICB2YXIgaSA9IDA7XG5cbiAgICB3aGlsZSAobm9kZXNbaV0gJiYgbm9kZXNbaV0gIT09IG5vZGUpIHtcbiAgICAgIGkgKz0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gISFub2Rlc1tpXTtcbiAgfTtcblxuICByZXR1cm4gbWF0Y2hGdW50aW9uLmNhbGwoZWxtLCBzZWxlY3Rvcik7XG59OyIsInZhciBvbGRQcmlzbUdsb2JhbCA9IGdsb2JhbC5QcmlzbTtcbnZhciBwcmlzbSA9IChnbG9iYWwuUHJpc20gPSByZXF1aXJlKCdwcmlzbWpzJykpO1xucmVxdWlyZSgncHJpc21qcy9jb21wb25lbnRzL3ByaXNtLWdyYXBocWwuanMnKTtcbnJlcXVpcmUoJ3ByaXNtanMvY29tcG9uZW50cy9wcmlzbS1jc3AuanMnKTtcbmdsb2JhbC5QcmlzbSA9IG9sZFByaXNtR2xvYmFsO1xuXG52YXIgZGVmYXVsdFRoZW1lID0ge1xuICAvLyBBZGFwdGVkIGZyb20gdGhlIGRlZmF1bHQgUHJpc20gdGhlbWU6XG4gIHByaXNtQ29tbWVudDogJyM3MDgwOTAnLCAvLyBzbGF0ZWdyYXlcbiAgcHJpc21Qcm9sb2c6ICdwcmlzbUNvbW1lbnQnLFxuICBwcmlzbURvY3R5cGU6ICdwcmlzbUNvbW1lbnQnLFxuICBwcmlzbUNkYXRhOiAncHJpc21Db21tZW50JyxcblxuICBwcmlzbVB1bmN0dWF0aW9uOiAnIzk5OScsXG5cbiAgcHJpc21TeW1ib2w6ICcjOTA1JyxcbiAgcHJpc21Qcm9wZXJ0eTogJ3ByaXNtU3ltYm9sJyxcbiAgcHJpc21UYWc6ICdwcmlzbVN5bWJvbCcsXG4gIHByaXNtQm9vbGVhbjogJ3ByaXNtU3ltYm9sJyxcbiAgcHJpc21OdW1iZXI6ICdwcmlzbVN5bWJvbCcsXG4gIHByaXNtQ29uc3RhbnQ6ICdwcmlzbVN5bWJvbCcsXG4gIHByaXNtRGVsZXRlZDogJ3ByaXNtU3ltYm9sJyxcblxuICBwcmlzbVN0cmluZzogJyM2OTAnLFxuICBwcmlzbVNlbGVjdG9yOiAncHJpc21TdHJpbmcnLFxuICBwcmlzbUF0dHJOYW1lOiAncHJpc21TdHJpbmcnLFxuICBwcmlzbUNoYXI6ICdwcmlzbVN0cmluZycsXG4gIHByaXNtQnVpbHRpbjogJ3ByaXNtU3RyaW5nJyxcbiAgcHJpc21JbnNlcnRlZDogJ3ByaXNtU3RyaW5nJyxcblxuICBwcmlzbU9wZXJhdG9yOiAnI2E2N2Y1OScsXG4gIHByaXNtVmFyaWFibGU6ICdwcmlzbU9wZXJhdG9yJyxcbiAgcHJpc21FbnRpdHk6ICdwcmlzbU9wZXJhdG9yJyxcbiAgcHJpc21Vcmw6ICdwcmlzbU9wZXJhdG9yJyxcbiAgcHJpc21Dc3NTdHJpbmc6ICdwcmlzbU9wZXJhdG9yJyxcblxuICBwcmlzbUtleXdvcmQ6ICcjMDdhJyxcbiAgcHJpc21BdHJ1bGU6ICdwcmlzbUtleXdvcmQnLFxuICBwcmlzbUF0dHJWYWx1ZTogJ3ByaXNtS2V5d29yZCcsXG5cbiAgcHJpc21GdW5jdGlvbjogJyNERDRBNjgnLFxuXG4gIHByaXNtUmVnZXg6ICcjZTkwJyxcbiAgcHJpc21JbXBvcnRhbnQ6IFsnI2U5MCcsICdib2xkJ11cbn07XG5cbnZhciBsYW5ndWFnZU1hcHBpbmcgPSB7XG4gICd0ZXh0L2h0bWwnOiAnbWFya3VwJyxcbiAgJ2FwcGxpY2F0aW9uL3htbCc6ICdtYXJrdXAnLFxuICAndGV4dC94bWwnOiAnbWFya3VwJyxcbiAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnamF2YXNjcmlwdCcsXG4gICd0ZXh0L2phdmFzY3JpcHQnOiAnamF2YXNjcmlwdCcsXG4gICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogJ2phdmFzY3JpcHQnLFxuICAndGV4dC9jc3MnOiAnY3NzJyxcbiAgaHRtbDogJ21hcmt1cCcsXG4gIHhtbDogJ21hcmt1cCcsXG4gIGM6ICdjbGlrZScsXG4gICdjKysnOiAnY2xpa2UnLFxuICBjcHA6ICdjbGlrZScsXG4gICdjIyc6ICdjbGlrZScsXG4gIGphdmE6ICdjbGlrZScsXG4gICdhcHBsaWNhdGlvbi9ncmFwaHFsJzogJ2dyYXBocWwnXG59O1xuXG5mdW5jdGlvbiB1cHBlckNhbWVsQ2FzZShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC8oPzpefC0pKFthLXpdKS9nLCBmdW5jdGlvbigkMCwgY2gpIHtcbiAgICByZXR1cm4gY2gudG9VcHBlckNhc2UoKTtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBuYW1lOiAnbWFnaWNwZW4tcHJpc20nLFxuICB2ZXJzaW9uOiByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICBpbnN0YWxsSW50bzogZnVuY3Rpb24obWFnaWNQZW4pIHtcbiAgICBPYmplY3Qua2V5cyhkZWZhdWx0VGhlbWUpLmZvckVhY2goZnVuY3Rpb24oc3R5bGVOYW1lKSB7XG4gICAgICB2YXIgc3R5bGUgPSBkZWZhdWx0VGhlbWVbc3R5bGVOYW1lXTtcbiAgICAgIHdoaWxlICh0eXBlb2Ygc3R5bGUgPT09ICdzdHJpbmcnICYmIHN0eWxlIGluIGRlZmF1bHRUaGVtZSkge1xuICAgICAgICBzdHlsZSA9IGRlZmF1bHRUaGVtZVtzdHlsZV07XG4gICAgICB9XG4gICAgICBtYWdpY1Blbi5hZGRTdHlsZShzdHlsZU5hbWUsIGZ1bmN0aW9uKHRleHQpIHtcbiAgICAgICAgdGhpcy50ZXh0KHRleHQsIHN0eWxlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgbWFnaWNQZW4uYWRkU3R5bGUoXG4gICAgICAnY29kZScsXG4gICAgICBmdW5jdGlvbihzb3VyY2VUZXh0LCBsYW5ndWFnZSkge1xuICAgICAgICBpZiAobGFuZ3VhZ2UgaW4gbGFuZ3VhZ2VNYXBwaW5nKSB7XG4gICAgICAgICAgbGFuZ3VhZ2UgPSBsYW5ndWFnZU1hcHBpbmdbbGFuZ3VhZ2VdO1xuICAgICAgICB9IGVsc2UgaWYgKC9cXCt4bWxcXGIvLnRlc3QobGFuZ3VhZ2UpKSB7XG4gICAgICAgICAgbGFuZ3VhZ2UgPSAnbWFya3VwJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShsYW5ndWFnZSBpbiBwcmlzbS5sYW5ndWFnZXMpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMudGV4dChzb3VyY2VUZXh0KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHZhciBjYXBpdGFsaXplZExhbmd1YWdlID0gdXBwZXJDYW1lbENhc2UobGFuZ3VhZ2UpO1xuICAgICAgICB2YXIgbGFuZ3VhZ2VEZWZpbml0aW9uID0gcHJpc20ubGFuZ3VhZ2VzW2xhbmd1YWdlXTtcblxuICAgICAgICBmdW5jdGlvbiBwcmludFRva2Vucyh0b2tlbiwgcGFyZW50U3R5bGUpIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0b2tlbikpIHtcbiAgICAgICAgICAgIHRva2VuLmZvckVhY2goZnVuY3Rpb24oc3ViVG9rZW4pIHtcbiAgICAgICAgICAgICAgcHJpbnRUb2tlbnMoc3ViVG9rZW4sIHBhcmVudFN0eWxlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdmFyIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlID0gdXBwZXJDYW1lbENhc2UocGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgdG9rZW4gPSB0b2tlbi5yZXBsYWNlKC8mbHQ7L2csICc8Jyk7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV1cbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICB0aGF0WydwcmlzbScgKyBjYXBpdGFsaXplZExhbmd1YWdlICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKFxuICAgICAgICAgICAgICAgIHRva2VuXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoYXRbJ3ByaXNtJyArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSkge1xuICAgICAgICAgICAgICB0aGF0WydwcmlzbScgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0odG9rZW4pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgbGFuZ3VhZ2VEZWZpbml0aW9uW3BhcmVudFN0eWxlXSAmJlxuICAgICAgICAgICAgICBsYW5ndWFnZURlZmluaXRpb25bcGFyZW50U3R5bGVdLmFsaWFzXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgcHJpbnRUb2tlbnModG9rZW4sIGxhbmd1YWdlRGVmaW5pdGlvbltwYXJlbnRTdHlsZV0uYWxpYXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhhdC50ZXh0KHRva2VuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJpbnRUb2tlbnModG9rZW4uY29udGVudCwgdG9rZW4udHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHByaW50VG9rZW5zKFxuICAgICAgICAgIHByaXNtLnRva2VuaXplKHNvdXJjZVRleHQsIHByaXNtLmxhbmd1YWdlc1tsYW5ndWFnZV0pLFxuICAgICAgICAgICd0ZXh0J1xuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIHRydWVcbiAgICApO1xuICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIl9hcmdzXCI6IFtcbiAgICBbXG4gICAgICB7XG4gICAgICAgIFwicmF3XCI6IFwibWFnaWNwZW4tcHJpc21AXjMuMC4xXCIsXG4gICAgICAgIFwic2NvcGVcIjogbnVsbCxcbiAgICAgICAgXCJlc2NhcGVkTmFtZVwiOiBcIm1hZ2ljcGVuLXByaXNtXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIm1hZ2ljcGVuLXByaXNtXCIsXG4gICAgICAgIFwicmF3U3BlY1wiOiBcIl4zLjAuMVwiLFxuICAgICAgICBcInNwZWNcIjogXCI+PTMuMC4xIDw0LjAuMFwiLFxuICAgICAgICBcInR5cGVcIjogXCJyYW5nZVwiXG4gICAgICB9LFxuICAgICAgXCIvVXNlcnMvYWxleC9Eb2N1bWVudHMvcHJvamVjdHMvdW5leHBlY3RlZC1kb21cIlxuICAgIF1cbiAgXSxcbiAgXCJfZnJvbVwiOiBcIm1hZ2ljcGVuLXByaXNtQD49My4wLjEgPDQuMC4wXCIsXG4gIFwiX2hhc1Nocmlua3dyYXBcIjogZmFsc2UsXG4gIFwiX2lkXCI6IFwibWFnaWNwZW4tcHJpc21AMy4wLjFcIixcbiAgXCJfaW5DYWNoZVwiOiB0cnVlLFxuICBcIl9sb2NhdGlvblwiOiBcIi9tYWdpY3Blbi1wcmlzbVwiLFxuICBcIl9ub2RlVmVyc2lvblwiOiBcIjEwLjE1LjFcIixcbiAgXCJfbnBtT3BlcmF0aW9uYWxJbnRlcm5hbFwiOiB7XG4gICAgXCJob3N0XCI6IFwiczM6Ly9ucG0tcmVnaXN0cnktcGFja2FnZXNcIixcbiAgICBcInRtcFwiOiBcInRtcC9tYWdpY3Blbi1wcmlzbV8zLjAuMV8xNTUyNzUwMzQwNzUwXzAuNjA0NzY5MTAxNzgwODA4MVwiXG4gIH0sXG4gIFwiX25wbVVzZXJcIjoge1xuICAgIFwibmFtZVwiOiBcInBhcGFuZHJlb3VcIixcbiAgICBcImVtYWlsXCI6IFwiYW5kcmVhc2xpbmRwZXRlcnNlbkBnbWFpbC5jb21cIlxuICB9LFxuICBcIl9ucG1WZXJzaW9uXCI6IFwiNi40LjFcIixcbiAgXCJfcGhhbnRvbUNoaWxkcmVuXCI6IHt9LFxuICBcIl9yZXF1ZXN0ZWRcIjoge1xuICAgIFwicmF3XCI6IFwibWFnaWNwZW4tcHJpc21AXjMuMC4xXCIsXG4gICAgXCJzY29wZVwiOiBudWxsLFxuICAgIFwiZXNjYXBlZE5hbWVcIjogXCJtYWdpY3Blbi1wcmlzbVwiLFxuICAgIFwibmFtZVwiOiBcIm1hZ2ljcGVuLXByaXNtXCIsXG4gICAgXCJyYXdTcGVjXCI6IFwiXjMuMC4xXCIsXG4gICAgXCJzcGVjXCI6IFwiPj0zLjAuMSA8NC4wLjBcIixcbiAgICBcInR5cGVcIjogXCJyYW5nZVwiXG4gIH0sXG4gIFwiX3JlcXVpcmVkQnlcIjogW1xuICAgIFwiL1wiXG4gIF0sXG4gIFwiX3Jlc29sdmVkXCI6IFwiaHR0cHM6Ly9yZWdpc3RyeS5ucG1qcy5vcmcvbWFnaWNwZW4tcHJpc20vLS9tYWdpY3Blbi1wcmlzbS0zLjAuMS50Z3pcIixcbiAgXCJfc2hhc3VtXCI6IFwiNWJmNTE2YmI5ZjhiMGZkODg5NTQ4Y2E0NTJjODYzY2IzMGU4NDNhMVwiLFxuICBcIl9zaHJpbmt3cmFwXCI6IG51bGwsXG4gIFwiX3NwZWNcIjogXCJtYWdpY3Blbi1wcmlzbUBeMy4wLjFcIixcbiAgXCJfd2hlcmVcIjogXCIvVXNlcnMvYWxleC9Eb2N1bWVudHMvcHJvamVjdHMvdW5leHBlY3RlZC1kb21cIixcbiAgXCJhdXRob3JcIjoge1xuICAgIFwibmFtZVwiOiBcIkFuZHJlYXMgTGluZFwiLFxuICAgIFwiZW1haWxcIjogXCJhbmRyZWFzbGluZHBldGVyc2VuQGdtYWlsLmNvbVwiXG4gIH0sXG4gIFwiYnVnc1wiOiB7XG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vdW5leHBlY3RlZGpzL21hZ2ljcGVuLXByaXNtL2lzc3Vlc1wiXG4gIH0sXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcInByaXNtanNcIjogXCJeMS4xNS4wXCJcbiAgfSxcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkFkZCBzeW50YXggaGlnaGxpZ2h0aW5nIHN1cHBvcnQgdG8gbWFnaWNwZW4gdmlhIHByaXNtLmpzXCIsXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTYuMi4zXCIsXG4gICAgXCJidW5kbGUtY29sbGFwc2VyXCI6IFwiXjEuMy4wXCIsXG4gICAgXCJjb3ZlcmFsbHNcIjogXCJeMy4wLjNcIixcbiAgICBcImVzbGludFwiOiBcIl41LjcuMFwiLFxuICAgIFwiZXNsaW50LWNvbmZpZy1wcmV0dGllclwiOiBcIl40LjEuMFwiLFxuICAgIFwiZXNsaW50LWNvbmZpZy1zdGFuZGFyZFwiOiBcIl4xMi4wLjBcIixcbiAgICBcImVzbGludC1wbHVnaW4taW1wb3J0XCI6IFwiXjIuMTYuMFwiLFxuICAgIFwiZXNsaW50LXBsdWdpbi1tb2NoYVwiOiBcIl41LjMuMFwiLFxuICAgIFwiZXNsaW50LXBsdWdpbi1ub2RlXCI6IFwiXjguMC4xXCIsXG4gICAgXCJlc2xpbnQtcGx1Z2luLXByb21pc2VcIjogXCJeNC4wLjFcIixcbiAgICBcImVzbGludC1wbHVnaW4tc3RhbmRhcmRcIjogXCJeNC4wLjBcIixcbiAgICBcIm1hZ2ljcGVuXCI6IFwiXjYuMC4yXCIsXG4gICAgXCJtb2NoYVwiOiBcIl42LjAuMlwiLFxuICAgIFwibnljXCI6IFwiXjEzLjMuMFwiLFxuICAgIFwicHJldHRpZXJcIjogXCJeMS4xNi40XCIsXG4gICAgXCJ1bmV4cGVjdGVkXCI6IFwiXjExLjIuMFwiXG4gIH0sXG4gIFwiZGlyZWN0b3JpZXNcIjoge30sXG4gIFwiZGlzdFwiOiB7XG4gICAgXCJpbnRlZ3JpdHlcIjogXCJzaGE1MTItQk5WNTlwK29UV0ZGNlB3MTlRbkJFR1lWM1c2cHFSVG9HSUdrbFhtMFJRbEU2TTlTZExVUGhkMFFLbFBsbjdMUHJFbkh2bzlFMWZQblcwT1hKb21SWHc9PVwiLFxuICAgIFwic2hhc3VtXCI6IFwiNWJmNTE2YmI5ZjhiMGZkODg5NTQ4Y2E0NTJjODYzY2IzMGU4NDNhMVwiLFxuICAgIFwidGFyYmFsbFwiOiBcImh0dHBzOi8vcmVnaXN0cnkubnBtanMub3JnL21hZ2ljcGVuLXByaXNtLy0vbWFnaWNwZW4tcHJpc20tMy4wLjEudGd6XCIsXG4gICAgXCJmaWxlQ291bnRcIjogNCxcbiAgICBcInVucGFja2VkU2l6ZVwiOiAzNTMzOSxcbiAgICBcIm5wbS1zaWduYXR1cmVcIjogXCItLS0tLUJFR0lOIFBHUCBTSUdOQVRVUkUtLS0tLVxcclxcblZlcnNpb246IE9wZW5QR1AuanMgdjMuMC40XFxyXFxuQ29tbWVudDogaHR0cHM6Ly9vcGVucGdwanMub3JnXFxyXFxuXFxyXFxud3NGY0JBRUJDQUFRQlFKY2pSY0ZDUkE5VFZzU0FuWldhZ0FBOHJZUC8zSU41bVNCaE9WWEJUcmI4c2s5XFxuWjFCR2FJemcwS2RyWXlFVW00UzFuak44bGZxZW5ha2MxNE1EUkFENGh1Rk1ESCtUV3BTZGJLWDVxajV4XFxuem9CcVFLNkgwWGxRZFE1dmFnM3BPTkJ6OU9HVTZteHFqTTRwbmhvZ1lEV1YwU2xYanlYdWMzUFN2UTZIXFxuUkt5SnJIN0h3U1Y1Z3U3RERZOWEwZ3NhalhVNEFoNnBFUi9ITkdRWFpDV0VTVmR1d2E0RVl6azFzcUJ4XFxuak52QVF4VUZmUlljU2lWVndmbzJmdEJFNk11cTcvREF5RlVGSno4ZWJsRlNYNGtCNSt1b3BtVkh5RkVYXFxudGJoZmwxUXl4c3pybXIvckR1ek5pNWdlY0c0dGF1RjYvRDNOQ3RNeFIxTk94Y3NTdjJNSml6M0ZvcVQyXFxuVW1LVG4rUC9QYjdHTE5jajczbVBGMnM2d0RYQkJyeXRKUjhwSU9NRDIyeVYzWlpIMFBxRDREc1F2akhLXFxuWW5TcCtrTFZTZUI3TmRBTEIreE5WRnhSZzJmZzZyRThDaVFKekZ0L3YrTVVzRGRNWDBzcVJHZTluOUVvXFxueklBU09BSlRyYlhmQzlVbGYwMUMxbUdTYnJONzc5ZmtLRjl0QzlrN1crTlh6aUkwRUtqbi9yOEFYZTc1XFxuU09YQUVWbXZhZkkrMzVXVWxIbjEvaG85N08zd3IrcG5nRUZPRVJwRVgxK05TSWJPYW5Td3czTG5yTFcrXFxuak1FSUdHajdOM3E3bTR6QVpkbjRnaVlqZWtWZXdMb0dNVEY5b0N6SU9jV3NZcWNiS2VWUlNGQjlZeVB0XFxuT3FTa0FLOHlnMnlndEtBZ3E1K3ViWEpGeG1BNnpjVDA3WmQ5R1ZyVXFNOTR4dmVDenNVeEF0UjJOVXFHXFxuVmNIMFxcclxcbj1ldkFKXFxyXFxuLS0tLS1FTkQgUEdQIFNJR05BVFVSRS0tLS0tXFxyXFxuXCJcbiAgfSxcbiAgXCJnaXRIZWFkXCI6IFwiMmM3MmYyMWUzZDE3NTBiY2VlOTc3ODY3ZGUyOGE3OWJlM2YxZTIxYlwiLFxuICBcImhvbWVwYWdlXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3VuZXhwZWN0ZWRqcy9tYWdpY3Blbi1wcmlzbSNyZWFkbWVcIixcbiAgXCJtYWluXCI6IFwibGliL21hZ2ljUGVuUHJpc20uanNcIixcbiAgXCJtYWludGFpbmVyc1wiOiBbXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiYWxleGplZmZidXJrZVwiLFxuICAgICAgXCJlbWFpbFwiOiBcImFsZXhAYWxleGplZmZidXJrZS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiZ3VzdGF2bmlrb2xhalwiLFxuICAgICAgXCJlbWFpbFwiOiBcImd1c3Rhdm5pa29sYWpAZ21haWwuY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcImpvZWxtdWt1dGh1XCIsXG4gICAgICBcImVtYWlsXCI6IFwiam9lbG11a3V0aHVAZ21haWwuY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcInBhcGFuZHJlb3VcIixcbiAgICAgIFwiZW1haWxcIjogXCJhbmRyZWFzbGluZHBldGVyc2VuQGdtYWlsLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJzdW5lc2ltb25zZW5cIixcbiAgICAgIFwiZW1haWxcIjogXCJzdW5lQHdlLWtub3dob3cuZGtcIlxuICAgIH1cbiAgXSxcbiAgXCJuYW1lXCI6IFwibWFnaWNwZW4tcHJpc21cIixcbiAgXCJueWNcIjoge1xuICAgIFwiaW5jbHVkZVwiOiBbXG4gICAgICBcImxpYi8qKlwiXG4gICAgXVxuICB9LFxuICBcIm9wdGlvbmFsRGVwZW5kZW5jaWVzXCI6IHt9LFxuICBcInJlYWRtZVwiOiBcIkVSUk9SOiBObyBSRUFETUUgZGF0YSBmb3VuZCFcIixcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImdpdCtodHRwczovL2dpdGh1Yi5jb20vdW5leHBlY3RlZGpzL21hZ2ljcGVuLXByaXNtLmdpdFwiXG4gIH0sXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJjaVwiOiBcIm5wbSBydW4gbGludCAmJiBucG0gcnVuIGNvdmVyYWdlXCIsXG4gICAgXCJjb3ZlcmFnZVwiOiBcIk5PREVfRU5WPWRldmVsb3BtZW50IG55YyAtLXJlcG9ydGVyPWxjb3YgLS1yZXBvcnRlcj10ZXh0IC0tYWxsIC0tIG5wbSB0ZXN0ICYmIGVjaG8gZ29vZ2xlLWNocm9tZSBjb3ZlcmFnZS9sY292LXJlcG9ydC9pbmRleC5odG1sXCIsXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IC4gJiYgcHJldHRpZXIgLS1jaGVjayAnKiovKi5qcydcIixcbiAgICBcInByZXB1Ymxpc2hcIjogXCJicm93c2VyaWZ5IC1wIGJ1bmRsZS1jb2xsYXBzZXIvcGx1Z2luIC1lIGxpYi9tYWdpY1BlblByaXNtIC1zIG1hZ2ljUGVuUHJpc20gPiBtYWdpY1BlblByaXNtLm1pbi5qc1wiLFxuICAgIFwidGVzdFwiOiBcIm1vY2hhXCJcbiAgfSxcbiAgXCJ2ZXJzaW9uXCI6IFwiMy4wLjFcIlxufVxuIiwiLyoqXG4gKiBPcmlnaW5hbCBieSBTY290dCBIZWxtZS5cbiAqXG4gKiBSZWZlcmVuY2U6IGh0dHBzOi8vc2NvdHRoZWxtZS5jby51ay9jc3AtY2hlYXQtc2hlZXQvXG4gKlxuICogU3VwcG9ydHMgdGhlIGZvbGxvd2luZzpcbiAqICAtIENTUCBMZXZlbCAxXG4gKiAgLSBDU1AgTGV2ZWwgMlxuICogIC0gQ1NQIExldmVsIDNcbiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuY3NwID0ge1xuXHQnZGlyZWN0aXZlJzogIHtcblx0XHRwYXR0ZXJuOiAvXFxiKD86KD86YmFzZS11cml8Zm9ybS1hY3Rpb258ZnJhbWUtYW5jZXN0b3JzfHBsdWdpbi10eXBlc3xyZWZlcnJlcnxyZWZsZWN0ZWQteHNzfHJlcG9ydC10b3xyZXBvcnQtdXJpfHJlcXVpcmUtc3JpLWZvcnxzYW5kYm94KSB8KD86YmxvY2stYWxsLW1peGVkLWNvbnRlbnR8ZGlzb3duLW9wZW5lcnx1cGdyYWRlLWluc2VjdXJlLXJlcXVlc3RzKSg/OiB8Oyl8KD86Y2hpbGR8Y29ubmVjdHxkZWZhdWx0fGZvbnR8ZnJhbWV8aW1nfG1hbmlmZXN0fG1lZGlhfG9iamVjdHxzY3JpcHR8c3R5bGV8d29ya2VyKS1zcmMgKS9pLFxuXHRcdGFsaWFzOiAna2V5d29yZCdcblx0fSxcblx0J3NhZmUnOiB7XG5cdFx0cGF0dGVybjogLycoPzpzZWxmfG5vbmV8c3RyaWN0LWR5bmFtaWN8KD86bm9uY2UtfHNoYSg/OjI1NnwzODR8NTEyKS0pW2EtekEtWlxcZCs9L10rKScvLFxuXHRcdGFsaWFzOiAnc2VsZWN0b3InXG5cdH0sXG5cdCd1bnNhZmUnOiB7XG5cdFx0cGF0dGVybjogLyg/Oid1bnNhZmUtaW5saW5lJ3wndW5zYWZlLWV2YWwnfCd1bnNhZmUtaGFzaGVkLWF0dHJpYnV0ZXMnfFxcKikvLFxuXHRcdGFsaWFzOiAnZnVuY3Rpb24nXG5cdH1cbn07IiwiUHJpc20ubGFuZ3VhZ2VzLmdyYXBocWwgPSB7XG5cdCdjb21tZW50JzogLyMuKi8sXG5cdCdzdHJpbmcnOiB7XG5cdFx0cGF0dGVybjogL1wiKD86XFxcXC58W15cXFxcXCJcXHJcXG5dKSpcIi8sXG5cdFx0Z3JlZWR5OiB0cnVlXG5cdH0sXG5cdCdudW1iZXInOiAvKD86XFxCLXxcXGIpXFxkKyg/OlxcLlxcZCspPyg/OmVbKy1dP1xcZCspP1xcYi9pLFxuXHQnYm9vbGVhbic6IC9cXGIoPzp0cnVlfGZhbHNlKVxcYi8sXG5cdCd2YXJpYWJsZSc6IC9cXCRbYS16X11cXHcqL2ksXG5cdCdkaXJlY3RpdmUnOiB7XG5cdFx0cGF0dGVybjogL0BbYS16X11cXHcqL2ksXG5cdFx0YWxpYXM6ICdmdW5jdGlvbidcblx0fSxcblx0J2F0dHItbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvW2Etel9dXFx3Kig/PVxccyooPzpcXCgoPzpbXigpXCJdfFwiKD86XFxcXC58W15cXFxcXCJcXHJcXG5dKSpcIikqXFwpKT86KS9pLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKFxcYig/OmVudW18aW1wbGVtZW50c3xpbnRlcmZhY2V8b258c2NhbGFyfHR5cGV8dW5pb24pXFxzKylbYS16QS1aX11cXHcqLyxcblx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdH0sXG5cdCdmcmFnbWVudCc6IHtcblx0XHRwYXR0ZXJuOiAvKFxcYmZyYWdtZW50XFxzK3xcXC57M31cXHMqKD8hb25cXGIpKVthLXpBLVpfXVxcdyovLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0YWxpYXM6ICdmdW5jdGlvbidcblx0fSxcblx0J2tleXdvcmQnOiAvXFxiKD86ZW51bXxmcmFnbWVudHxpbXBsZW1lbnRzfGlucHV0fGludGVyZmFjZXxtdXRhdGlvbnxvbnxxdWVyeXxzY2FsYXJ8c2NoZW1hfHR5cGV8dW5pb24pXFxiLyxcblx0J29wZXJhdG9yJzogL1shPXxdfFxcLnszfS8sXG5cdCdwdW5jdHVhdGlvbic6IC9bISgpe31cXFtcXF06PSxdLyxcblx0J2NvbnN0YW50JzogL1xcYig/IUlEXFxiKVtBLVpdW0EtWl9cXGRdKlxcYi9cbn07XG4iLCJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXG5cdD8gd2luZG93ICAgLy8gaWYgaW4gYnJvd3NlclxuXHQ6IChcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXG5cdFx0PyBzZWxmIC8vIGlmIGluIHdvcmtlclxuXHRcdDoge30gICAvLyBpZiBpbiBub2RlIGpzXG5cdCk7XG5cbi8qKlxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xuICogTUlUIGxpY2Vuc2UgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHAvXG4gKiBAYXV0aG9yIExlYSBWZXJvdSBodHRwOi8vbGVhLnZlcm91Lm1lXG4gKi9cblxudmFyIFByaXNtID0gKGZ1bmN0aW9uIChfc2VsZil7XG5cbi8vIFByaXZhdGUgaGVscGVyIHZhcnNcbnZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKFtcXHctXSspXFxiL2k7XG52YXIgdW5pcXVlSWQgPSAwO1xuXG52YXIgXyA9IHtcblx0bWFudWFsOiBfc2VsZi5QcmlzbSAmJiBfc2VsZi5QcmlzbS5tYW51YWwsXG5cdGRpc2FibGVXb3JrZXJNZXNzYWdlSGFuZGxlcjogX3NlbGYuUHJpc20gJiYgX3NlbGYuUHJpc20uZGlzYWJsZVdvcmtlck1lc3NhZ2VIYW5kbGVyLFxuXHR1dGlsOiB7XG5cdFx0ZW5jb2RlOiBmdW5jdGlvbiAodG9rZW5zKSB7XG5cdFx0XHRpZiAodG9rZW5zIGluc3RhbmNlb2YgVG9rZW4pIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBUb2tlbih0b2tlbnMudHlwZSwgXy51dGlsLmVuY29kZSh0b2tlbnMuY29udGVudCksIHRva2Vucy5hbGlhcyk7XG5cdFx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodG9rZW5zKSkge1xuXHRcdFx0XHRyZXR1cm4gdG9rZW5zLm1hcChfLnV0aWwuZW5jb2RlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHR0eXBlOiBmdW5jdGlvbiAobykge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5zbGljZSg4LCAtMSk7XG5cdFx0fSxcblxuXHRcdG9iaklkOiBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRpZiAoIW9ialsnX19pZCddKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvYmpbJ19faWQnXTtcblx0XHR9LFxuXG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiBkZWVwQ2xvbmUobywgdmlzaXRlZCkge1xuXHRcdFx0dmFyIGNsb25lLCBpZCwgdHlwZSA9IF8udXRpbC50eXBlKG8pO1xuXHRcdFx0dmlzaXRlZCA9IHZpc2l0ZWQgfHwge307XG5cblx0XHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0XHRjYXNlICdPYmplY3QnOlxuXHRcdFx0XHRcdGlkID0gXy51dGlsLm9iaklkKG8pO1xuXHRcdFx0XHRcdGlmICh2aXNpdGVkW2lkXSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHZpc2l0ZWRbaWRdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjbG9uZSA9IHt9O1xuXHRcdFx0XHRcdHZpc2l0ZWRbaWRdID0gY2xvbmU7XG5cblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xuXHRcdFx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gZGVlcENsb25lKG9ba2V5XSwgdmlzaXRlZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xuXG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHRpZCA9IF8udXRpbC5vYmpJZChvKTtcblx0XHRcdFx0XHRpZiAodmlzaXRlZFtpZF0pIHtcblx0XHRcdFx0XHRcdHJldHVybiB2aXNpdGVkW2lkXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2xvbmUgPSBbXTtcblx0XHRcdFx0XHR2aXNpdGVkW2lkXSA9IGNsb25lO1xuXG5cdFx0XHRcdFx0by5mb3JFYWNoKGZ1bmN0aW9uICh2LCBpKSB7XG5cdFx0XHRcdFx0XHRjbG9uZVtpXSA9IGRlZXBDbG9uZSh2LCB2aXNpdGVkKTtcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdHJldHVybiBjbG9uZTtcblxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybiBvO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRsYW5ndWFnZXM6IHtcblx0XHRleHRlbmQ6IGZ1bmN0aW9uIChpZCwgcmVkZWYpIHtcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XG5cblx0XHRcdGZvciAodmFyIGtleSBpbiByZWRlZikge1xuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbGFuZztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0ICogSW5zZXJ0IGEgdG9rZW4gYmVmb3JlIGFub3RoZXIgdG9rZW4gaW4gYSBsYW5ndWFnZSBsaXRlcmFsXG5cdFx0ICogQXMgdGhpcyBuZWVkcyB0byByZWNyZWF0ZSB0aGUgb2JqZWN0ICh3ZSBjYW5ub3QgYWN0dWFsbHkgaW5zZXJ0IGJlZm9yZSBrZXlzIGluIG9iamVjdCBsaXRlcmFscyksXG5cdFx0ICogd2UgY2Fubm90IGp1c3QgcHJvdmlkZSBhbiBvYmplY3QsIHdlIG5lZWQgYW4gb2JqZWN0IGFuZCBhIGtleS5cblx0XHQgKiBAcGFyYW0gaW5zaWRlIFRoZSBrZXkgKG9yIGxhbmd1YWdlIGlkKSBvZiB0aGUgcGFyZW50XG5cdFx0ICogQHBhcmFtIGJlZm9yZSBUaGUga2V5IHRvIGluc2VydCBiZWZvcmUuXG5cdFx0ICogQHBhcmFtIGluc2VydCBPYmplY3Qgd2l0aCB0aGUga2V5L3ZhbHVlIHBhaXJzIHRvIGluc2VydFxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cblx0XHQgKi9cblx0XHRpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uIChpbnNpZGUsIGJlZm9yZSwgaW5zZXJ0LCByb290KSB7XG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xuXHRcdFx0dmFyIHJldCA9IHt9O1xuXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XG5cdFx0XHRcdGlmIChncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSkge1xuXG5cdFx0XHRcdFx0aWYgKHRva2VuID09IGJlZm9yZSkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBEbyBub3QgaW5zZXJ0IHRva2VuIHdoaWNoIGFsc28gb2NjdXIgaW4gaW5zZXJ0LiBTZWUgIzE1MjVcblx0XHRcdFx0XHRpZiAoIWluc2VydC5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcblx0XHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dmFyIG9sZCA9IHJvb3RbaW5zaWRlXTtcblx0XHRcdHJvb3RbaW5zaWRlXSA9IHJldDtcblxuXHRcdFx0Ly8gVXBkYXRlIHJlZmVyZW5jZXMgaW4gb3RoZXIgbGFuZ3VhZ2UgZGVmaW5pdGlvbnNcblx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhfLmxhbmd1YWdlcywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRcdFx0XHRpZiAodmFsdWUgPT09IG9sZCAmJiBrZXkgIT0gaW5zaWRlKSB7XG5cdFx0XHRcdFx0dGhpc1trZXldID0gcmV0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHJldDtcblx0XHR9LFxuXG5cdFx0Ly8gVHJhdmVyc2UgYSBsYW5ndWFnZSBkZWZpbml0aW9uIHdpdGggRGVwdGggRmlyc3QgU2VhcmNoXG5cdFx0REZTOiBmdW5jdGlvbiBERlMobywgY2FsbGJhY2ssIHR5cGUsIHZpc2l0ZWQpIHtcblx0XHRcdHZpc2l0ZWQgPSB2aXNpdGVkIHx8IHt9O1xuXG5cdFx0XHR2YXIgb2JqSWQgPSBfLnV0aWwub2JqSWQ7XG5cblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwobywgaSwgb1tpXSwgdHlwZSB8fCBpKTtcblxuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IG9baV0sXG5cdFx0XHRcdFx0ICAgIHByb3BlcnR5VHlwZSA9IF8udXRpbC50eXBlKHByb3BlcnR5KTtcblxuXHRcdFx0XHRcdGlmIChwcm9wZXJ0eVR5cGUgPT09ICdPYmplY3QnICYmICF2aXNpdGVkW29iaklkKHByb3BlcnR5KV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbb2JqSWQocHJvcGVydHkpXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRERlMocHJvcGVydHksIGNhbGxiYWNrLCBudWxsLCB2aXNpdGVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnQXJyYXknICYmICF2aXNpdGVkW29iaklkKHByb3BlcnR5KV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbb2JqSWQocHJvcGVydHkpXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRERlMocHJvcGVydHksIGNhbGxiYWNrLCBpLCB2aXNpdGVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdHBsdWdpbnM6IHt9LFxuXG5cdGhpZ2hsaWdodEFsbDogZnVuY3Rpb24oYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Xy5oaWdobGlnaHRBbGxVbmRlcihkb2N1bWVudCwgYXN5bmMsIGNhbGxiYWNrKTtcblx0fSxcblxuXHRoaWdobGlnaHRBbGxVbmRlcjogZnVuY3Rpb24oY29udGFpbmVyLCBhc3luYywgY2FsbGJhY2spIHtcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XG5cblx0XHR2YXIgZWxlbWVudHMgPSBlbnYuZWxlbWVudHMgfHwgY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoZW52LnNlbGVjdG9yKTtcblxuXHRcdGZvciAodmFyIGk9MCwgZWxlbWVudDsgZWxlbWVudCA9IGVsZW1lbnRzW2krK107KSB7XG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGVudi5jYWxsYmFjayk7XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdC8vIEZpbmQgbGFuZ3VhZ2Vcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XG5cblx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdH1cblxuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdGxhbmd1YWdlID0gKHBhcmVudC5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywnJ10pWzFdLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRncmFtbWFyID0gXy5sYW5ndWFnZXNbbGFuZ3VhZ2VdO1xuXHRcdH1cblxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgZWxlbWVudCwgaWYgbm90IHByZXNlbnRcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXG5cdFx0aWYgKGVsZW1lbnQucGFyZW50Tm9kZSkge1xuXHRcdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBwYXJlbnQsIGZvciBzdHlsaW5nXG5cdFx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cblx0XHRcdGlmICgvcHJlL2kudGVzdChwYXJlbnQubm9kZU5hbWUpKSB7XG5cdFx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcblxuXHRcdHZhciBlbnYgPSB7XG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxuXHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdFx0Z3JhbW1hcjogZ3JhbW1hcixcblx0XHRcdGNvZGU6IGNvZGVcblx0XHR9O1xuXG5cdFx0dmFyIGluc2VydEhpZ2hsaWdodGVkQ29kZSA9IGZ1bmN0aW9uIChoaWdobGlnaHRlZENvZGUpIHtcblx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBoaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcblxuXHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblxuXHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1zYW5pdHktY2hlY2snLCBlbnYpO1xuXG5cdFx0aWYgKCFlbnYuY29kZSkge1xuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XG5cblx0XHRpZiAoIWVudi5ncmFtbWFyKSB7XG5cdFx0XHRpbnNlcnRIaWdobGlnaHRlZENvZGUoXy51dGlsLmVuY29kZShlbnYuY29kZSkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChhc3luYyAmJiBfc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1xuXG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGluc2VydEhpZ2hsaWdodGVkQ29kZShldnQuZGF0YSk7XG5cdFx0XHR9O1xuXG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRsYW5ndWFnZTogZW52Lmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2U6IHRydWVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpbnNlcnRIaWdobGlnaHRlZENvZGUoXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpKTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0Y29kZTogdGV4dCxcblx0XHRcdGdyYW1tYXI6IGdyYW1tYXIsXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2Vcblx0XHR9O1xuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtdG9rZW5pemUnLCBlbnYpO1xuXHRcdGVudi50b2tlbnMgPSBfLnRva2VuaXplKGVudi5jb2RlLCBlbnYuZ3JhbW1hcik7XG5cdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLXRva2VuaXplJywgZW52KTtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udXRpbC5lbmNvZGUoZW52LnRva2VucyksIGVudi5sYW5ndWFnZSk7XG5cdH0sXG5cblx0bWF0Y2hHcmFtbWFyOiBmdW5jdGlvbiAodGV4dCwgc3RyYXJyLCBncmFtbWFyLCBpbmRleCwgc3RhcnRQb3MsIG9uZXNob3QsIHRhcmdldCkge1xuXHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblx0XHRcdGlmKCFncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSB8fCAhZ3JhbW1hclt0b2tlbl0pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0b2tlbiA9PSB0YXJnZXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcGF0dGVybnMgPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdHBhdHRlcm5zID0gKF8udXRpbC50eXBlKHBhdHRlcm5zKSA9PT0gXCJBcnJheVwiKSA/IHBhdHRlcm5zIDogW3BhdHRlcm5zXTtcblxuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwYXR0ZXJucy5sZW5ndGg7ICsraikge1xuXHRcdFx0XHR2YXIgcGF0dGVybiA9IHBhdHRlcm5zW2pdLFxuXHRcdFx0XHRcdGluc2lkZSA9IHBhdHRlcm4uaW5zaWRlLFxuXHRcdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcblx0XHRcdFx0XHRncmVlZHkgPSAhIXBhdHRlcm4uZ3JlZWR5LFxuXHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSAwLFxuXHRcdFx0XHRcdGFsaWFzID0gcGF0dGVybi5hbGlhcztcblxuXHRcdFx0XHRpZiAoZ3JlZWR5ICYmICFwYXR0ZXJuLnBhdHRlcm4uZ2xvYmFsKSB7XG5cdFx0XHRcdFx0Ly8gV2l0aG91dCB0aGUgZ2xvYmFsIGZsYWcsIGxhc3RJbmRleCB3b24ndCB3b3JrXG5cdFx0XHRcdFx0dmFyIGZsYWdzID0gcGF0dGVybi5wYXR0ZXJuLnRvU3RyaW5nKCkubWF0Y2goL1tpbXV5XSokLylbMF07XG5cdFx0XHRcdFx0cGF0dGVybi5wYXR0ZXJuID0gUmVnRXhwKHBhdHRlcm4ucGF0dGVybi5zb3VyY2UsIGZsYWdzICsgXCJnXCIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybiB8fCBwYXR0ZXJuO1xuXG5cdFx0XHRcdC8vIERvbuKAmXQgY2FjaGUgbGVuZ3RoIGFzIGl0IGNoYW5nZXMgZHVyaW5nIHRoZSBsb29wXG5cdFx0XHRcdGZvciAodmFyIGkgPSBpbmRleCwgcG9zID0gc3RhcnRQb3M7IGkgPCBzdHJhcnIubGVuZ3RoOyBwb3MgKz0gc3RyYXJyW2ldLmxlbmd0aCwgKytpKSB7XG5cblx0XHRcdFx0XHR2YXIgc3RyID0gc3RyYXJyW2ldO1xuXG5cdFx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Ly8gU29tZXRoaW5nIHdlbnQgdGVycmlibHkgd3JvbmcsIEFCT1JULCBBQk9SVCFcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoc3RyIGluc3RhbmNlb2YgVG9rZW4pIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChncmVlZHkgJiYgaSAhPSBzdHJhcnIubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSBwb3M7XG5cdFx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWModGV4dCk7XG5cdFx0XHRcdFx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcblx0XHRcdFx0XHRcdCAgICB0byA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoLFxuXHRcdFx0XHRcdFx0ICAgIGsgPSBpLFxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIGxlbiA9IHN0cmFyci5sZW5ndGg7IGsgPCBsZW4gJiYgKHAgPCB0byB8fCAoIXN0cmFycltrXS50eXBlICYmICFzdHJhcnJbayAtIDFdLmdyZWVkeSkpOyArK2spIHtcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBpbmRleCBpIHRvIHRoZSBlbGVtZW50IGluIHN0cmFyciB0aGF0IGlzIGNsb3Nlc3QgdG8gZnJvbVxuXHRcdFx0XHRcdFx0XHRpZiAoZnJvbSA+PSBwKSB7XG5cdFx0XHRcdFx0XHRcdFx0KytpO1xuXHRcdFx0XHRcdFx0XHRcdHBvcyA9IHA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gSWYgc3RyYXJyW2ldIGlzIGEgVG9rZW4sIHRoZW4gdGhlIG1hdGNoIHN0YXJ0cyBpbnNpZGUgYW5vdGhlciBUb2tlbiwgd2hpY2ggaXMgaW52YWxpZFxuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOdW1iZXIgb2YgdG9rZW5zIHRvIGRlbGV0ZSBhbmQgcmVwbGFjZSB3aXRoIHRoZSBuZXcgbWF0Y2hcblx0XHRcdFx0XHRcdGRlbE51bSA9IGsgLSBpO1xuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xuXHRcdFx0XHRcdFx0bWF0Y2guaW5kZXggLT0gcG9zO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IDA7XG5cblx0XHRcdFx0XHRcdHZhciBtYXRjaCA9IHBhdHRlcm4uZXhlYyhzdHIpLFxuXHRcdFx0XHRcdFx0XHRkZWxOdW0gPSAxO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdFx0XHRcdGlmIChvbmVzaG90KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0gPyBtYXRjaFsxXS5sZW5ndGggOiAwO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggKyBsb29rYmVoaW5kTGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBtYXRjaCA9IG1hdGNoWzBdLnNsaWNlKGxvb2tiZWhpbmRMZW5ndGgpLFxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXG5cdFx0XHRcdFx0ICAgIGJlZm9yZSA9IHN0ci5zbGljZSgwLCBmcm9tKSxcblx0XHRcdFx0XHQgICAgYWZ0ZXIgPSBzdHIuc2xpY2UodG8pO1xuXG5cdFx0XHRcdFx0dmFyIGFyZ3MgPSBbaSwgZGVsTnVtXTtcblxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcblx0XHRcdFx0XHRcdCsraTtcblx0XHRcdFx0XHRcdHBvcyArPSBiZWZvcmUubGVuZ3RoO1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XG5cblx0XHRcdFx0XHRhcmdzLnB1c2god3JhcHBlZCk7XG5cblx0XHRcdFx0XHRpZiAoYWZ0ZXIpIHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChhZnRlcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0QXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShzdHJhcnIsIGFyZ3MpO1xuXG5cdFx0XHRcdFx0aWYgKGRlbE51bSAhPSAxKVxuXHRcdFx0XHRcdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCBpLCBwb3MsIHRydWUsIHRva2VuKTtcblxuXHRcdFx0XHRcdGlmIChvbmVzaG90KVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0dG9rZW5pemU6IGZ1bmN0aW9uKHRleHQsIGdyYW1tYXIpIHtcblx0XHR2YXIgc3RyYXJyID0gW3RleHRdO1xuXG5cdFx0dmFyIHJlc3QgPSBncmFtbWFyLnJlc3Q7XG5cblx0XHRpZiAocmVzdCkge1xuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gcmVzdCkge1xuXHRcdFx0XHRncmFtbWFyW3Rva2VuXSA9IHJlc3RbdG9rZW5dO1xuXHRcdFx0fVxuXG5cdFx0XHRkZWxldGUgZ3JhbW1hci5yZXN0O1xuXHRcdH1cblxuXHRcdF8ubWF0Y2hHcmFtbWFyKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgMCwgMCwgZmFsc2UpO1xuXG5cdFx0cmV0dXJuIHN0cmFycjtcblx0fSxcblxuXHRob29rczoge1xuXHRcdGFsbDoge30sXG5cblx0XHRhZGQ6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xuXHRcdFx0dmFyIGhvb2tzID0gXy5ob29rcy5hbGw7XG5cblx0XHRcdGhvb2tzW25hbWVdID0gaG9va3NbbmFtZV0gfHwgW107XG5cblx0XHRcdGhvb2tzW25hbWVdLnB1c2goY2FsbGJhY2spO1xuXHRcdH0sXG5cblx0XHRydW46IGZ1bmN0aW9uIChuYW1lLCBlbnYpIHtcblx0XHRcdHZhciBjYWxsYmFja3MgPSBfLmhvb2tzLmFsbFtuYW1lXTtcblxuXHRcdFx0aWYgKCFjYWxsYmFja3MgfHwgIWNhbGxiYWNrcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBpPTAsIGNhbGxiYWNrOyBjYWxsYmFjayA9IGNhbGxiYWNrc1tpKytdOykge1xuXHRcdFx0XHRjYWxsYmFjayhlbnYpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRUb2tlbjogVG9rZW5cbn07XG5cbl9zZWxmLlByaXNtID0gXztcblxuZnVuY3Rpb24gVG9rZW4odHlwZSwgY29udGVudCwgYWxpYXMsIG1hdGNoZWRTdHIsIGdyZWVkeSkge1xuXHR0aGlzLnR5cGUgPSB0eXBlO1xuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xuXHR0aGlzLmFsaWFzID0gYWxpYXM7XG5cdC8vIENvcHkgb2YgdGhlIGZ1bGwgc3RyaW5nIHRoaXMgdG9rZW4gd2FzIGNyZWF0ZWQgZnJvbVxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xuXHR0aGlzLmdyZWVkeSA9ICEhZ3JlZWR5O1xufVxuXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XG5cdGlmICh0eXBlb2YgbyA9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBvO1xuXHR9XG5cblx0aWYgKEFycmF5LmlzQXJyYXkobykpIHtcblx0XHRyZXR1cm4gby5tYXAoZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShlbGVtZW50LCBsYW5ndWFnZSwgbyk7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHR2YXIgZW52ID0ge1xuXHRcdHR5cGU6IG8udHlwZSxcblx0XHRjb250ZW50OiBUb2tlbi5zdHJpbmdpZnkoby5jb250ZW50LCBsYW5ndWFnZSwgcGFyZW50KSxcblx0XHR0YWc6ICdzcGFuJyxcblx0XHRjbGFzc2VzOiBbJ3Rva2VuJywgby50eXBlXSxcblx0XHRhdHRyaWJ1dGVzOiB7fSxcblx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0cGFyZW50OiBwYXJlbnRcblx0fTtcblxuXHRpZiAoby5hbGlhcykge1xuXHRcdHZhciBhbGlhc2VzID0gQXJyYXkuaXNBcnJheShvLmFsaWFzKSA/IG8uYWxpYXMgOiBbby5hbGlhc107XG5cdFx0QXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoZW52LmNsYXNzZXMsIGFsaWFzZXMpO1xuXHR9XG5cblx0Xy5ob29rcy5ydW4oJ3dyYXAnLCBlbnYpO1xuXG5cdHZhciBhdHRyaWJ1dGVzID0gT2JqZWN0LmtleXMoZW52LmF0dHJpYnV0ZXMpLm1hcChmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIG5hbWUgKyAnPVwiJyArIChlbnYuYXR0cmlidXRlc1tuYW1lXSB8fCAnJykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpICsgJ1wiJztcblx0fSkuam9pbignICcpO1xuXG5cdHJldHVybiAnPCcgKyBlbnYudGFnICsgJyBjbGFzcz1cIicgKyBlbnYuY2xhc3Nlcy5qb2luKCcgJykgKyAnXCInICsgKGF0dHJpYnV0ZXMgPyAnICcgKyBhdHRyaWJ1dGVzIDogJycpICsgJz4nICsgZW52LmNvbnRlbnQgKyAnPC8nICsgZW52LnRhZyArICc+JztcblxufTtcblxuaWYgKCFfc2VsZi5kb2N1bWVudCkge1xuXHRpZiAoIV9zZWxmLmFkZEV2ZW50TGlzdGVuZXIpIHtcblx0XHQvLyBpbiBOb2RlLmpzXG5cdFx0cmV0dXJuIF87XG5cdH1cblxuXHRpZiAoIV8uZGlzYWJsZVdvcmtlck1lc3NhZ2VIYW5kbGVyKSB7XG5cdFx0Ly8gSW4gd29ya2VyXG5cdFx0X3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldnQpIHtcblx0XHRcdHZhciBtZXNzYWdlID0gSlNPTi5wYXJzZShldnQuZGF0YSksXG5cdFx0XHRcdGxhbmcgPSBtZXNzYWdlLmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlID0gbWVzc2FnZS5jb2RlLFxuXHRcdFx0XHRpbW1lZGlhdGVDbG9zZSA9IG1lc3NhZ2UuaW1tZWRpYXRlQ2xvc2U7XG5cblx0XHRcdF9zZWxmLnBvc3RNZXNzYWdlKF8uaGlnaGxpZ2h0KGNvZGUsIF8ubGFuZ3VhZ2VzW2xhbmddLCBsYW5nKSk7XG5cdFx0XHRpZiAoaW1tZWRpYXRlQ2xvc2UpIHtcblx0XHRcdFx0X3NlbGYuY2xvc2UoKTtcblx0XHRcdH1cblx0XHR9LCBmYWxzZSk7XG5cdH1cblxuXHRyZXR1cm4gXztcbn1cblxuLy9HZXQgY3VycmVudCBzY3JpcHQgYW5kIGhpZ2hsaWdodFxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQgfHwgW10uc2xpY2UuY2FsbChkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKSkucG9wKCk7XG5cbmlmIChzY3JpcHQpIHtcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XG5cblx0aWYgKCFfLm1hbnVhbCAmJiAhc2NyaXB0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1tYW51YWwnKSkge1xuXHRcdGlmKGRvY3VtZW50LnJlYWR5U3RhdGUgIT09IFwibG9hZGluZ1wiKSB7XG5cdFx0XHRpZiAod2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKF8uaGlnaGxpZ2h0QWxsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KF8uaGlnaGxpZ2h0QWxsLCAxNik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIF8uaGlnaGxpZ2h0QWxsKTtcblx0XHR9XG5cdH1cbn1cblxucmV0dXJuIF87XG5cbn0pKF9zZWxmKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJpc207XG59XG5cbi8vIGhhY2sgZm9yIGNvbXBvbmVudHMgdG8gd29yayBjb3JyZWN0bHkgaW4gbm9kZS5qc1xuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdGdsb2JhbC5QcmlzbSA9IFByaXNtO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XG5cdCdjb21tZW50JzogLzwhLS1bXFxzXFxTXSo/LS0+Lyxcblx0J3Byb2xvZyc6IC88XFw/W1xcc1xcU10rP1xcPz4vLFxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxuXHQnY2RhdGEnOiAvPCFcXFtDREFUQVxcW1tcXHNcXFNdKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8JV0rKD86XFxzKD86XFxzKlteXFxzPlxcLz1dKyg/Olxccyo9XFxzKig/OlwiW15cIl0qXCJ8J1teJ10qJ3xbXlxccydcIj49XSsoPz1bXFxzPl0pKXwoPz1bXFxzLz5dKSkpKyk/XFxzKlxcLz8+L2ksXG5cdFx0Z3JlZWR5OiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9ePFxcLz8vLFxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0cGF0dGVybjogLz1cXHMqKD86XCJbXlwiXSpcInwnW14nXSonfFteXFxzJ1wiPj1dKykvaSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogW1xuXHRcdFx0XHRcdFx0L149Lyxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogL14oXFxzKilbXCInXXxbXCInXSQvLFxuXHRcdFx0XHRcdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+Lyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXlxccz5cXC9dKy8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mIz9bXFxkYS16XXsxLDh9Oy9pXG59O1xuXG5QcmlzbS5sYW5ndWFnZXMubWFya3VwWyd0YWcnXS5pbnNpZGVbJ2F0dHItdmFsdWUnXS5pbnNpZGVbJ2VudGl0eSddID1cblx0UHJpc20ubGFuZ3VhZ2VzLm1hcmt1cFsnZW50aXR5J107XG5cbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XG5QcmlzbS5ob29rcy5hZGQoJ3dyYXAnLCBmdW5jdGlvbihlbnYpIHtcblxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3RpdGxlJ10gPSBlbnYuY29udGVudC5yZXBsYWNlKC8mYW1wOy8sICcmJyk7XG5cdH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcsICdhZGRJbmxpbmVkJywge1xuXHQvKipcblx0ICogQWRkcyBhbiBpbmxpbmVkIGxhbmd1YWdlIHRvIG1hcmt1cC5cblx0ICpcblx0ICogQW4gZXhhbXBsZSBvZiBhbiBpbmxpbmVkIGxhbmd1YWdlIGlzIENTUyB3aXRoIGA8c3R5bGU+YCB0YWdzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGFnTmFtZSBUaGUgbmFtZSBvZiB0aGUgdGFnIHRoYXQgY29udGFpbnMgdGhlIGlubGluZWQgbGFuZ3VhZ2UuIFRoaXMgbmFtZSB3aWxsIGJlIHRyZWF0ZWQgYXNcblx0ICogY2FzZSBpbnNlbnNpdGl2ZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGxhbmcgVGhlIGxhbmd1YWdlIGtleS5cblx0ICogQGV4YW1wbGVcblx0ICogYWRkSW5saW5lZCgnc3R5bGUnLCAnY3NzJyk7XG5cdCAqL1xuXHR2YWx1ZTogZnVuY3Rpb24gYWRkSW5saW5lZCh0YWdOYW1lLCBsYW5nKSB7XG5cdFx0dmFyIGluY2x1ZGVkQ2RhdGFJbnNpZGUgPSB7fTtcblx0XHRpbmNsdWRlZENkYXRhSW5zaWRlWydsYW5ndWFnZS0nICsgbGFuZ10gPSB7XG5cdFx0XHRwYXR0ZXJuOiAvKF48IVxcW0NEQVRBXFxbKVtcXHNcXFNdKz8oPz1cXF1cXF0+JCkvaSxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlc1tsYW5nXVxuXHRcdH07XG5cdFx0aW5jbHVkZWRDZGF0YUluc2lkZVsnY2RhdGEnXSA9IC9ePCFcXFtDREFUQVxcW3xcXF1cXF0+JC9pO1xuXG5cdFx0dmFyIGluc2lkZSA9IHtcblx0XHRcdCdpbmNsdWRlZC1jZGF0YSc6IHtcblx0XHRcdFx0cGF0dGVybjogLzwhXFxbQ0RBVEFcXFtbXFxzXFxTXSo/XFxdXFxdPi9pLFxuXHRcdFx0XHRpbnNpZGU6IGluY2x1ZGVkQ2RhdGFJbnNpZGVcblx0XHRcdH1cblx0XHR9O1xuXHRcdGluc2lkZVsnbGFuZ3VhZ2UtJyArIGxhbmddID0ge1xuXHRcdFx0cGF0dGVybjogL1tcXHNcXFNdKy8sXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlc1tsYW5nXVxuXHRcdH07XG5cblx0XHR2YXIgZGVmID0ge307XG5cdFx0ZGVmW3RhZ05hbWVdID0ge1xuXHRcdFx0cGF0dGVybjogUmVnRXhwKC8oPF9fW1xcc1xcU10qPz4pKD86PCFcXFtDREFUQVxcW1tcXHNcXFNdKj9cXF1cXF0+XFxzKnxbXFxzXFxTXSkqPyg/PTxcXC9fXz4pLy5zb3VyY2UucmVwbGFjZSgvX18vZywgdGFnTmFtZSksICdpJyksXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdFx0Z3JlZWR5OiB0cnVlLFxuXHRcdFx0aW5zaWRlOiBpbnNpZGVcblx0XHR9O1xuXG5cdFx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ2NkYXRhJywgZGVmKTtcblx0fVxufSk7XG5cblByaXNtLmxhbmd1YWdlcy54bWwgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdtYXJrdXAnLCB7fSk7XG5QcmlzbS5sYW5ndWFnZXMuaHRtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMubWF0aG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbihmdW5jdGlvbiAoUHJpc20pIHtcblxuXHR2YXIgc3RyaW5nID0gLyhcInwnKSg/OlxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvO1xuXG5cdFByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdFx0J2NvbW1lbnQnOiAvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy8sXG5cdFx0J2F0cnVsZSc6IHtcblx0XHRcdHBhdHRlcm46IC9AW1xcdy1dKz9bXFxzXFxTXSo/KD86O3woPz1cXHMqXFx7KSkvaSxcblx0XHRcdGluc2lkZToge1xuXHRcdFx0XHQncnVsZSc6IC9AW1xcdy1dKy9cblx0XHRcdFx0Ly8gU2VlIHJlc3QgYmVsb3dcblx0XHRcdH1cblx0XHR9LFxuXHRcdCd1cmwnOiBSZWdFeHAoJ3VybFxcXFwoKD86JyArIHN0cmluZy5zb3VyY2UgKyAnfC4qPylcXFxcKScsICdpJyksXG5cdFx0J3NlbGVjdG9yJzogUmVnRXhwKCdbXnt9XFxcXHNdKD86W157fTtcIlxcJ118JyArIHN0cmluZy5zb3VyY2UgKyAnKSo/KD89XFxcXHMqXFxcXHspJyksXG5cdFx0J3N0cmluZyc6IHtcblx0XHRcdHBhdHRlcm46IHN0cmluZyxcblx0XHRcdGdyZWVkeTogdHJ1ZVxuXHRcdH0sXG5cdFx0J3Byb3BlcnR5JzogL1stX2EtelxceEEwLVxcdUZGRkZdWy1cXHdcXHhBMC1cXHVGRkZGXSooPz1cXHMqOikvaSxcblx0XHQnaW1wb3J0YW50JzogLyFpbXBvcnRhbnRcXGIvaSxcblx0XHQnZnVuY3Rpb24nOiAvWy1hLXowLTldKyg/PVxcKCkvaSxcblx0XHQncHVuY3R1YXRpb24nOiAvWygpe307OixdL1xuXHR9O1xuXG5cdFByaXNtLmxhbmd1YWdlcy5jc3NbJ2F0cnVsZSddLmluc2lkZS5yZXN0ID0gUHJpc20ubGFuZ3VhZ2VzLmNzcztcblxuXHR2YXIgbWFya3VwID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblx0aWYgKG1hcmt1cCkge1xuXHRcdG1hcmt1cC50YWcuYWRkSW5saW5lZCgnc3R5bGUnLCAnY3NzJyk7XG5cblx0XHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdpbnNpZGUnLCAnYXR0ci12YWx1ZScsIHtcblx0XHRcdCdzdHlsZS1hdHRyJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvXFxzKnN0eWxlPShcInwnKSg/OlxcXFxbXFxzXFxTXXwoPyFcXDEpW15cXFxcXSkqXFwxL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxuXHRcdFx0XHRcdFx0aW5zaWRlOiBtYXJrdXAudGFnLmluc2lkZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogL15cXHMqPVxccypbJ1wiXXxbJ1wiXVxccyokLyxcblx0XHRcdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0XHRcdHBhdHRlcm46IC8uKy9pLFxuXHRcdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuY3NzXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhbGlhczogJ2xhbmd1YWdlLWNzcydcblx0XHRcdH1cblx0XHR9LCBtYXJrdXAudGFnKTtcblx0fVxuXG59KFByaXNtKSk7XG5cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1jbGlrZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuY2xpa2UgPSB7XG5cdCdjb21tZW50JzogW1xuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFxdKVxcL1xcKltcXHNcXFNdKj8oPzpcXCpcXC98JCkvLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXDpdKVxcL1xcLy4qLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRncmVlZHk6IHRydWVcblx0XHR9XG5cdF0sXG5cdCdzdHJpbmcnOiB7XG5cdFx0cGF0dGVybjogLyhbXCInXSkoPzpcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxLyxcblx0XHRncmVlZHk6IHRydWVcblx0fSxcblx0J2NsYXNzLW5hbWUnOiB7XG5cdFx0cGF0dGVybjogLygoPzpcXGIoPzpjbGFzc3xpbnRlcmZhY2V8ZXh0ZW5kc3xpbXBsZW1lbnRzfHRyYWl0fGluc3RhbmNlb2Z8bmV3KVxccyspfCg/OmNhdGNoXFxzK1xcKCkpW1xcdy5cXFxcXSsvaSxcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0cHVuY3R1YXRpb246IC9bLlxcXFxdL1xuXHRcdH1cblx0fSxcblx0J2tleXdvcmQnOiAvXFxiKD86aWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258bmV3fHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWUpXFxiLyxcblx0J2Jvb2xlYW4nOiAvXFxiKD86dHJ1ZXxmYWxzZSlcXGIvLFxuXHQnZnVuY3Rpb24nOiAvXFx3Kyg/PVxcKCkvLFxuXHQnbnVtYmVyJzogL1xcYjB4W1xcZGEtZl0rXFxifCg/OlxcYlxcZCtcXC4/XFxkKnxcXEJcXC5cXGQrKSg/OmVbKy1dP1xcZCspPy9pLFxuXHQnb3BlcmF0b3InOiAvLS0/fFxcK1xcKz98IT0/PT98PD0/fD49P3w9PT89P3wmJj98XFx8XFx8P3xcXD98XFwqfFxcL3x+fFxcXnwlLyxcblx0J3B1bmN0dWF0aW9uJzogL1t7fVtcXF07KCksLjpdL1xufTtcblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcblx0J2NsYXNzLW5hbWUnOiBbXG5cdFx0UHJpc20ubGFuZ3VhZ2VzLmNsaWtlWydjbGFzcy1uYW1lJ10sXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhefFteJFxcd1xceEEwLVxcdUZGRkZdKVtfJEEtWlxceEEwLVxcdUZGRkZdWyRcXHdcXHhBMC1cXHVGRkZGXSooPz1cXC4oPzpwcm90b3R5cGV8Y29uc3RydWN0b3IpKS8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fVxuXHRdLFxuXHQna2V5d29yZCc6IFtcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKCg/Ol58fSlcXHMqKSg/OmNhdGNofGZpbmFsbHkpXFxiLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oXnxbXi5dKVxcYig/OmFzfGFzeW5jKD89XFxzKig/OmZ1bmN0aW9uXFxifFxcKHxbJFxcd1xceEEwLVxcdUZGRkZdfCQpKXxhd2FpdHxicmVha3xjYXNlfGNsYXNzfGNvbnN0fGNvbnRpbnVlfGRlYnVnZ2VyfGRlZmF1bHR8ZGVsZXRlfGRvfGVsc2V8ZW51bXxleHBvcnR8ZXh0ZW5kc3xmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dW5kZWZpbmVkfHZhcnx2b2lkfHdoaWxlfHdpdGh8eWllbGQpXFxiLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRdLFxuXHQnbnVtYmVyJzogL1xcYig/Oig/OjBbeFhdW1xcZEEtRmEtZl0rfDBbYkJdWzAxXSt8MFtvT11bMC03XSspbj98XFxkK258TmFOfEluZmluaXR5KVxcYnwoPzpcXGJcXGQrXFwuP1xcZCp8XFxCXFwuXFxkKykoPzpbRWVdWystXT9cXGQrKT8vLFxuXHQvLyBBbGxvdyBmb3IgYWxsIG5vbi1BU0NJSSBjaGFyYWN0ZXJzIChTZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjAwODQ0NClcblx0J2Z1bmN0aW9uJzogL1tfJGEtekEtWlxceEEwLVxcdUZGRkZdWyRcXHdcXHhBMC1cXHVGRkZGXSooPz1cXHMqKD86XFwuXFxzKig/OmFwcGx5fGJpbmR8Y2FsbClcXHMqKT9cXCgpLyxcblx0J29wZXJhdG9yJzogLy1bLT1dP3xcXCtbKz1dP3whPT89P3w8PD89P3w+Pj8+Pz0/fD0oPzo9PT98Pik/fCZbJj1dP3xcXHxbfD1dP3xcXCpcXCo/PT98XFwvPT98fnxcXF49P3wlPT98XFw/fFxcLnszfS9cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFsnY2xhc3MtbmFtZSddWzBdLnBhdHRlcm4gPSAvKFxcYig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8aW5zdGFuY2VvZnxuZXcpXFxzKylbXFx3LlxcXFxdKy9cblxuUHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnamF2YXNjcmlwdCcsICdrZXl3b3JkJywge1xuXHQncmVnZXgnOiB7XG5cdFx0cGF0dGVybjogLygoPzpefFteJFxcd1xceEEwLVxcdUZGRkYuXCInXFxdKVxcc10pXFxzKilcXC8oXFxbKD86W15cXF1cXFxcXFxyXFxuXXxcXFxcLikqXXxcXFxcLnxbXi9cXFxcXFxbXFxyXFxuXSkrXFwvW2dpbXl1XXswLDV9KD89XFxzKigkfFtcXHJcXG4sLjt9KVxcXV0pKS8sXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRncmVlZHk6IHRydWVcblx0fSxcblx0Ly8gVGhpcyBtdXN0IGJlIGRlY2xhcmVkIGJlZm9yZSBrZXl3b3JkIGJlY2F1c2Ugd2UgdXNlIFwiZnVuY3Rpb25cIiBpbnNpZGUgdGhlIGxvb2stZm9yd2FyZFxuXHQnZnVuY3Rpb24tdmFyaWFibGUnOiB7XG5cdFx0cGF0dGVybjogL1tfJGEtekEtWlxceEEwLVxcdUZGRkZdWyRcXHdcXHhBMC1cXHVGRkZGXSooPz1cXHMqWz06XVxccyooPzphc3luY1xccyopPyg/OlxcYmZ1bmN0aW9uXFxifCg/OlxcKCg/OlteKCldfFxcKFteKCldKlxcKSkqXFwpfFtfJGEtekEtWlxceEEwLVxcdUZGRkZdWyRcXHdcXHhBMC1cXHVGRkZGXSopXFxzKj0+KSkvLFxuXHRcdGFsaWFzOiAnZnVuY3Rpb24nXG5cdH0sXG5cdCdwYXJhbWV0ZXInOiBbXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhmdW5jdGlvbig/OlxccytbXyRBLVphLXpcXHhBMC1cXHVGRkZGXVskXFx3XFx4QTAtXFx1RkZGRl0qKT9cXHMqXFwoXFxzKikoPyFcXHMpKD86W14oKV18XFwoW14oKV0qXFwpKSs/KD89XFxzKlxcKSkvLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHRcblx0XHR9LFxuXHRcdHtcblx0XHRcdHBhdHRlcm46IC9bXyRhLXpcXHhBMC1cXHVGRkZGXVskXFx3XFx4QTAtXFx1RkZGRl0qKD89XFxzKj0+KS9pLFxuXHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLyhcXChcXHMqKSg/IVxccykoPzpbXigpXXxcXChbXigpXSpcXCkpKz8oPz1cXHMqXFwpXFxzKj0+KS8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0cGF0dGVybjogLygoPzpcXGJ8XFxzfF4pKD8hKD86YXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dW5kZWZpbmVkfHZhcnx2b2lkfHdoaWxlfHdpdGh8eWllbGQpKD8hWyRcXHdcXHhBMC1cXHVGRkZGXSkpKD86W18kQS1aYS16XFx4QTAtXFx1RkZGRl1bJFxcd1xceEEwLVxcdUZGRkZdKlxccyopXFwoXFxzKikoPyFcXHMpKD86W14oKV18XFwoW14oKV0qXFwpKSs/KD89XFxzKlxcKVxccypcXHspLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XG5cdFx0fVxuXHRdLFxuXHQnY29uc3RhbnQnOiAvXFxiW0EtWl0oPzpbQS1aX118XFxkeD8pKlxcYi9cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcblx0J3RlbXBsYXRlLXN0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvYCg/OlxcXFxbXFxzXFxTXXxcXCR7W159XSt9fFteXFxcXGBdKSpgLyxcblx0XHRncmVlZHk6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQnaW50ZXJwb2xhdGlvbic6IHtcblx0XHRcdFx0cGF0dGVybjogL1xcJHtbXn1dK30vLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnaW50ZXJwb2xhdGlvbi1wdW5jdHVhdGlvbic6IHtcblx0XHRcdFx0XHRcdHBhdHRlcm46IC9eXFwke3x9JC8sXG5cdFx0XHRcdFx0XHRhbGlhczogJ3B1bmN0dWF0aW9uJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVzdDogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHRcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdzdHJpbmcnOiAvW1xcc1xcU10rL1xuXHRcdH1cblx0fVxufSk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5tYXJrdXAudGFnLmFkZElubGluZWQoJ3NjcmlwdCcsICdqYXZhc2NyaXB0Jyk7XG59XG5cblByaXNtLmxhbmd1YWdlcy5qcyA9IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tZmlsZS1oaWdobGlnaHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuKGZ1bmN0aW9uICgpIHtcblx0aWYgKHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyB8fCAhc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IFtjb250YWluZXI9ZG9jdW1lbnRdXG5cdCAqL1xuXHRzZWxmLlByaXNtLmZpbGVIaWdobGlnaHQgPSBmdW5jdGlvbihjb250YWluZXIpIHtcblx0XHRjb250YWluZXIgPSBjb250YWluZXIgfHwgZG9jdW1lbnQ7XG5cblx0XHR2YXIgRXh0ZW5zaW9ucyA9IHtcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0Jyxcblx0XHRcdCdweSc6ICdweXRob24nLFxuXHRcdFx0J3JiJzogJ3J1YnknLFxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcblx0XHRcdCdwc20xJzogJ3Bvd2Vyc2hlbGwnLFxuXHRcdFx0J3NoJzogJ2Jhc2gnLFxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXG5cdFx0XHQnaCc6ICdjJyxcblx0XHRcdCd0ZXgnOiAnbGF0ZXgnXG5cdFx0fTtcblxuXHRcdEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xuXHRcdFx0Ly8gaWdub3JlIGlmIGFscmVhZHkgbG9hZGVkXG5cdFx0XHRpZiAocHJlLmhhc0F0dHJpYnV0ZSgnZGF0YS1zcmMtbG9hZGVkJykpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBsb2FkIGN1cnJlbnRcblx0XHRcdHZhciBzcmMgPSBwcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xuXG5cdFx0XHR2YXIgbGFuZ3VhZ2UsIHBhcmVudCA9IHByZTtcblx0XHRcdHZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKFtcXHctXSspXFxiL2k7XG5cdFx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdFx0bGFuZ3VhZ2UgPSAocHJlLmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCAnJ10pWzFdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWxhbmd1YWdlKSB7XG5cdFx0XHRcdHZhciBleHRlbnNpb24gPSAoc3JjLm1hdGNoKC9cXC4oXFx3KykkLykgfHwgWywgJyddKVsxXTtcblx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKTtcblx0XHRcdGNvZGUuY2xhc3NOYW1lID0gJ2xhbmd1YWdlLScgKyBsYW5ndWFnZTtcblxuXHRcdFx0cHJlLnRleHRDb250ZW50ID0gJyc7XG5cblx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAnTG9hZGluZ+KApic7XG5cblx0XHRcdHByZS5hcHBlbmRDaGlsZChjb2RlKTtcblxuXHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG5cdFx0XHR4aHIub3BlbignR0VUJywgc3JjLCB0cnVlKTtcblxuXHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcblxuXHRcdFx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcblx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSB4aHIucmVzcG9uc2VUZXh0O1xuXG5cdFx0XHRcdFx0XHRQcmlzbS5oaWdobGlnaHRFbGVtZW50KGNvZGUpO1xuXHRcdFx0XHRcdFx0Ly8gbWFyayBhcyBsb2FkZWRcblx0XHRcdFx0XHRcdHByZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjLWxvYWRlZCcsICcnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoeGhyLnN0YXR1cyA+PSA0MDApIHtcblx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0eGhyLnNlbmQobnVsbCk7XG5cdFx0fSk7XG5cblx0XHRpZiAoUHJpc20ucGx1Z2lucy50b29sYmFyKSB7XG5cdFx0XHRQcmlzbS5wbHVnaW5zLnRvb2xiYXIucmVnaXN0ZXJCdXR0b24oJ2Rvd25sb2FkLWZpbGUnLCBmdW5jdGlvbiAoZW52KSB7XG5cdFx0XHRcdHZhciBwcmUgPSBlbnYuZWxlbWVudC5wYXJlbnROb2RlO1xuXHRcdFx0XHRpZiAoIXByZSB8fCAhL3ByZS9pLnRlc3QocHJlLm5vZGVOYW1lKSB8fCAhcHJlLmhhc0F0dHJpYnV0ZSgnZGF0YS1zcmMnKSB8fCAhcHJlLmhhc0F0dHJpYnV0ZSgnZGF0YS1kb3dubG9hZC1saW5rJykpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHNyYyA9IHByZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG5cdFx0XHRcdHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdFx0XHRhLnRleHRDb250ZW50ID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1kb3dubG9hZC1saW5rLWxhYmVsJykgfHwgJ0Rvd25sb2FkJztcblx0XHRcdFx0YS5zZXRBdHRyaWJ1dGUoJ2Rvd25sb2FkJywgJycpO1xuXHRcdFx0XHRhLmhyZWYgPSBzcmM7XG5cdFx0XHRcdHJldHVybiBhO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdH07XG5cblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBleGVjdXRlIGluc2lkZSBoYW5kbGVyLCBmb3IgZHJvcHBpbmcgRXZlbnQgYXMgYXJndW1lbnRcblx0XHRzZWxmLlByaXNtLmZpbGVIaWdobGlnaHQoKTtcblx0fSk7XG5cbn0pKCk7XG4iXX0=
