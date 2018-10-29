'use strict';

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
    return !/^\s*\w+\s*:\s*\w+\s*$|^$/.test(part);
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
        output.append(_diff4(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)).diff);
        return output;
      }
    });

    expect.exportType({
      name: 'HTMLDocument',
      base: 'DOMDocument',
      identify: function identify(obj) {
        return this.baseType.identify(obj) && obj.contentType === 'text/html';
      }
    });

    expect.exportType({
      name: 'XMLDocument',
      base: 'DOMDocument',
      identify: function identify(obj) {
        return this.baseType.identify(obj) && /^(?:application|text)\/xml|\+xml\b/.test(obj.contentType);
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
        output.block(_diff5(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)).diff);
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
          output.nl().indentLines().i().block(_diff6(makeAttachedDOMNodeList(actual.childNodes), makeAttachedDOMNodeList(expected.childNodes)).diff).nl().outdentLines();
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
        class: function _class(className) {
          var actualClasses = getClassNamesFromAttributeValue(className);
          if (typeof value === 'string') {
            value = getClassNamesFromAttributeValue(value);
          }
          return bubbleError(function () {
            return expect(actualClasses.sort(), 'to equal', value.sort());
          });
        }
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
      var isHtml = subject.ownerDocument.contentType === 'text/html';

      expect.argsOutput = function (output) {
        return output.code(value, isHtml ? 'html' : 'xml');
      };

      return expect(subject, 'to [exhaustively] satisfy', (isHtml ? parseHtml(value, true) : parseXml(value)).childNodes);
    });

    expect.exportAssertion('<DOMNodeList> to [exhaustively] satisfy <DOMNodeList>', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
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

      var isHtml = subject.ownerDocument.contentType === 'text/html';
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
      var unsupportedOptions = Object.keys(value).filter(function (key) {
        return key !== 'attributes' && key !== 'name' && key !== 'children' && key !== 'onlyAttributes' && key !== 'textContent';
      });
      if (unsupportedOptions.length > 0) {
        throw new Error('Unsupported option' + (unsupportedOptions.length === 1 ? '' : 's') + ': ' + unsupportedOptions.join(', '));
      }

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
            return bubbleError(function () {
              return expect(makeAttachedDOMNodeList(subject.childNodes, subject.ownerDocument.contentType), 'to satisfy', value.children);
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
                    output.nl().indentLines().i().block(childrenDiff.diff).nl().outdentLines();
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
  }
};