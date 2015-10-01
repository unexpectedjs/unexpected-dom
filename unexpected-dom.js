(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var arrayChanges = require('array-changes');
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
    try {
      htmlDocument = require('jsdom').jsdom(str);
    } catch (err) {
      throw new Error('unexpected-dom' + (assertionNameForErrorMessage ? ' (' + assertionNameForErrorMessage + ')' : '') + ': Running outside a browser, but could not find the `jsdom` module. Please npm install jsdom to make this work.');
    }
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
    try {
      return require('jsdom').jsdom(str, { parsingMode: 'xml' });
    } catch (err) {
      throw new Error('unexpected-dom' + (assertionNameForErrorMessage ? ' (' + assertionNameForErrorMessage + ')' : '') + ': Running outside a browser (or in a browser without DOMParser), but could not find the `jsdom` module. Please npm install jsdom to make this work.');
    }
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

function getAttributes(element) {
  var isHtml = element.ownerDocument.contentType === 'text/html';
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
  var isHtml = element.ownerDocument.contentType === 'text/html';
  var elementName = isHtml ? element.nodeName.toLowerCase() : element.nodeName;
  if (isHtml && isVoidElement(elementName) && element.childNodes.length === 0) {
    return '';
  } else {
    return '</' + elementName + '>';
  }
}

function diffNodeLists(actual, expected, output, diff, inspect, equal) {
  var changes = arrayChanges(Array.prototype.slice.call(actual), Array.prototype.slice.call(expected), equal, function (a, b) {
    // Figure out whether a and b are "struturally similar" so they can be diffed inline.
    return (
      a.nodeType === 1 && b.nodeType === 1 &&
      a.nodeName === b.nodeName
    );
  });

  changes.forEach(function (diffItem, index) {
    output.i().block(function () {
      var type = diffItem.type;
      if (type === 'insert') {
        this.annotationBlock(function () {
          this.error('missing ').block(inspect(diffItem.value));
        });
      } else if (type === 'remove') {
        this.block(inspect(diffItem.value).sp().error('// should be removed'));
      } else if (type === 'equal') {
        this.block(inspect(diffItem.value));
      } else {
        var valueDiff = diff(diffItem.value, diffItem.expected);
        if (valueDiff && valueDiff.inline) {
          this.block(valueDiff.diff);
        } else if (valueDiff) {
          this.block(inspect(diffItem.value).sp()).annotationBlock(function () {
            this.shouldEqualError(diffItem.expected, inspect).nl().append(valueDiff.diff);
          });
        } else {
          this.block(inspect(diffItem.value).sp()).annotationBlock(function () {
            this.shouldEqualError(diffItem.expected, inspect);
          });
        }
      }
    }).nl(index < changes.length - 1 ? 1 : 0);
  });
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
        return a.nodeValue.trim() === b.nodeValue.trim();
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
      identify: function (obj) {
        return (
          obj &&
          typeof obj.length === 'number' &&
          typeof obj.toString === 'function' &&
          typeof obj.item === 'function' &&
          obj.toString().indexOf('NodeList') !== -1
        );
      }
    });

    // Fake type to make it possible to build 'to satisfy' diffs to be rendered inline:
    expect.addType({
      name: 'attachedDOMNodeList',
      base: 'array-like',
      prefix: function (output) { return output; },
      suffix: function (output) { return output; },
      delimiter: function (output) { return output; },
      identify: function (obj) {
        return obj && obj._isAttachedDOMNodeList;
      }
    });

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
        diffNodeLists(actual.childNodes, expected.childNodes, output, diff, inspect, equal);
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
        diffNodeLists(actual.childNodes, expected.childNodes, output, diff, inspect, equal);
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
        return a.nodeName.toLowerCase() === b.nodeName.toLowerCase() && equal(getAttributes(a), getAttributes(b)) && equal(a.childNodes, b.childNodes);
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
        var isHtml = actual.ownerDocument.contentType === 'text/html';
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
          output.nl().indentLines();
          diffNodeLists(actual.childNodes, expected.childNodes, output, diff, inspect, equal);
          output.nl().outdentLines();
        }

        output.code(stringifyEndTag(actual), 'html');
        return result;
      }
    });

    expect.addAssertion('DOMElement', 'to [only] have (class|classes)', function (expect, subject, value) {
      var flags = this.flags;
      if (flags.only) {
        return expect(subject, 'to have attributes', {
          class: function (className) {
            var actualClasses = getClassNamesFromAttributeValue(className);
            if (typeof value === 'string') {
              value = getClassNamesFromAttributeValue(value);
            }
            if (flags.only) {
              return topLevelExpect(actualClasses.sort(), 'to equal', value.sort());
            } else {
              return topLevelExpect.apply(topLevelExpect, [actualClasses, 'to contain'].concat(value));
            }
          }
        });
      } else {
        return expect(subject, 'to have attributes', { class: value });
      }
    });

    expect.addAssertion('DOMTextNode', 'to [exhaustively] satisfy', function (expect, subject, value) {
      return expect(subject.nodeValue, 'to satisfy', expect.findTypeOf(value).name === 'DOMTextNode' ? value.nodeValue : value);
    });

    function convertDOMNodeToSatisfySpec(node, isHtml) {
      if (node.nodeType === 1) {
        // DOMElement
        var result = {
          name: isHtml ? node.nodeName.toLowerCase() : node.nodeName,
          attributes: {}
        };
        for (var i = 0; i < node.attributes.length ; i += 1) {
          result.attributes[node.attributes[i].name] = isHtml && isBooleanAttribute(node.attributes[i].name) ? true : (node.attributes[i].value || '');
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

    expect.addAssertion('DOMDocumentFragment', 'to [exhaustively] satisfy', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
      var valueType = expect.findTypeOf(value);
      if (valueType.name === 'string') {
        var originalValue = value;
        this.argsOutput = function (output) {
          output.code(originalValue, isHtml ? 'html' : 'xml');
        };
        value = isHtml ? parseHtml(value, true, this.testDescription) : parseXml(value, this.testDescription);
      }

      if (value && value.nodeType === 11) {
        value = Array.prototype.map.call(value.childNodes, function (childNode) {
          return convertDOMNodeToSatisfySpec(childNode, isHtml);
        });
      }

      return expect(subject.childNodes, 'to [exhaustively] satisfy', value);
    });

    expect.addAssertion('DOMElement', 'to [exhaustively] satisfy', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
      if (typeof value === 'string') {
        var documentFragment = isHtml ? parseHtml(value, true, this.testDescription) : parseXml(value, this.testDescription);
        if (documentFragment.childNodes.length !== 1) {
          throw new Error('HTMLElement to satisfy string: Only a single node is supported');
        }
        var originalValue = value;
        value = documentFragment.childNodes[0];
        this.argsOutput = function (output) {
          output.code(originalValue, isHtml ? 'html' : 'xml');
        };
      }
      if (expect.findTypeOf(value).name === 'DOMElement') {
        value = convertDOMNodeToSatisfySpec(value, isHtml);
      }
      if (value && typeof value === 'object') {
        var unsupportedOptions = Object.keys(value).filter(function (key) {
          return key !== 'attributes' && key !== 'name' && key !== 'children' && key !== 'onlyAttributes' && key !== 'textContent';
        });
        if (unsupportedOptions.length > 0) {
          throw new Error('Unsupported option' + (unsupportedOptions.length === 1 ? '' : 's') + ': ' + unsupportedOptions.join(', '));
        }
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
            var nodeListForDiffing = [];
            for (var i = 0 ; i < subject.childNodes.length ; i += 1) {
              nodeListForDiffing.push(subject.childNodes[i]);
            }
            nodeListForDiffing._isAttachedDOMNodeList = true;
            return topLevelExpect(nodeListForDiffing, 'to satisfy', value.children);
          } else if (typeof value.textContent !== 'undefined') {
            return topLevelExpect(subject.textContent, 'to satisfy', value.textContent);
          }
        }),
        attributes: {}
      };

      var onlyAttributes = value && value.onlyAttributes || this.flags.exhaustively;
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
                    this.append(childrenDiff.diff);
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

    expect.addAssertion('DOMElement', 'to [only] have (attribute|attributes)', function (expect, subject, value) {
      if (typeof value === 'string') {
        if (arguments.length > 3) {
          value = Array.prototype.slice.call(arguments, 2);
        }
      } else if (!value || typeof value !== 'object') {
        throw new Error('to have attributes: Argument must be a string, an array, or an object');
      }
      return expect(subject, 'to satisfy', { attributes: value, onlyAttributes: this.flags.only });
    });

    expect.addAssertion('DOMElement', 'to have [no] (child|children)', function (expect, subject, query, cmp) {
      if (this.flags.no) {
        this.errorMode = 'nested';
        return expect(Array.prototype.slice.call(subject.childNodes), 'to be an empty array');
      } else {
        var children = Array.prototype.slice.call(subject.querySelectorAll(query));
        throw children;
      }
    });

    expect.addAssertion('DOMElement', 'to have text', function (expect, subject, value) {
      return expect(subject.textContent, 'to satisfy', value);
    });

    expect.addAssertion(['DOMDocument', 'DOMElement'], 'queried for [first]', function (expect, subject, value) {
      var queryResult;

      this.errorMode = 'nested';

      if (this.flags.first) {
        queryResult = subject.querySelector(value);
        if (!queryResult) {
          expect.fail(function (output) {
            output.error('The selector').sp().jsString(value).sp().error('yielded no results');
          });
        }
      } else {
        queryResult = subject.querySelectorAll(value);
        if (queryResult.length === 0) {
          expect.fail(function (output) {
            output.error('The selector').sp().jsString(value).sp().error('yielded no results');
          });
        }
      }
      return this.shift(expect, queryResult, 1);
    });

    expect.addAssertion(['DOMDocument', 'DOMElement'], 'to contain [no] elements matching', function (expect, subject, value) {
      if (this.flags.no) {
        return expect(subject.querySelectorAll(value), 'to satisfy', []);
      }
      return expect(subject.querySelectorAll(value), 'not to satisfy', []);
    });

    expect.addAssertion(['DOMDocument', 'DOMElement'], '[not] to match', function (expect, subject, value) {
      return expect(matchesSelector(subject, value), 'to be', (this.flags.not ? false : true));
    });

    expect.addAssertion('string', 'when parsed as (html|HTML) [fragment]', function (expect, subject) {
      this.errorMode = 'nested';
      return this.shift(expect, parseHtml(subject, this.flags.fragment, this.testDescription), 0);
    });

    expect.addAssertion('string', 'when parsed as (xml|XML)', function (expect, subject) {
      this.errorMode = 'nested';
      return this.shift(expect, parseXml(subject, this.testDescription), 0);
    });
  }
};

},{"./matchesSelector":2,"array-changes":3,"jsdom":"jsdom","magicpen-prism":6}],2:[function(require,module,exports){
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
var arrayDiff = require('arraydiff');

function extend(target) {
    for (var i = 1; i < arguments.length; i += 1) {
        var source = arguments[i];
        Object.keys(source).forEach(function (key) {
            target[key] = source[key];
        });
    }
    return target;
}

module.exports = function arrayChanges(actual, expected, equal, similar) {
    var mutatedArray = new Array(actual.length);

    for (var k = 0; k < actual.length; k += 1) {
        mutatedArray[k] = {
            type: 'similar',
            value: actual[k]
        };
    }

    if (mutatedArray.length > 0) {
        mutatedArray[mutatedArray.length - 1].last = true;
    }

    similar = similar || function (a, b) {
        return false;
    };

    var itemsDiff = arrayDiff([].concat(actual), [].concat(expected), function (a, b) {
        return equal(a, b) || similar(a, b);
    });

    var removeTable = [];
    function offsetIndex(index) {
        return index + (removeTable[index - 1] || 0);
    }

    var removes = itemsDiff.filter(function (diffItem) {
        return diffItem.type === 'remove';
    });

    var removesByIndex = {};
    var removedItems = 0;
    removes.forEach(function (diffItem) {
        var removeIndex = removedItems + diffItem.index;
        mutatedArray.slice(removeIndex, diffItem.howMany + removeIndex).forEach(function (v) {
            v.type = 'remove';
        });
        removedItems += diffItem.howMany;
        removesByIndex[diffItem.index] = removedItems;
    });

    function updateRemoveTable() {
        removedItems = 0;
        Array.prototype.forEach.call(actual, function (_, index) {
            removedItems += removesByIndex[index] || 0;
            removeTable[index] = removedItems;
        });
    }

    updateRemoveTable();

    var moves = itemsDiff.filter(function (diffItem) {
        return diffItem.type === 'move';
    });

    var movedItems = 0;
    moves.forEach(function (diffItem) {
        var moveFromIndex = offsetIndex(diffItem.from);
        var removed = mutatedArray.slice(moveFromIndex, diffItem.howMany + moveFromIndex);
        var added = removed.map(function (v) {
            return extend({}, v, { last: false, type: 'insert' });
        });
        removed.forEach(function (v) {
            v.type = 'remove';
        });
        Array.prototype.splice.apply(mutatedArray, [offsetIndex(diffItem.to), 0].concat(added));
        movedItems += diffItem.howMany;
        removesByIndex[diffItem.from] = movedItems;
        updateRemoveTable();
    });

    var inserts = itemsDiff.filter(function (diffItem) {
        return diffItem.type === 'insert';
    });

    inserts.forEach(function (diffItem) {
        var added = new Array(diffItem.values.length);
        for (var i = 0 ; i < diffItem.values.length ; i += 1) {
            added[i] = {
                type: 'insert',
                value: diffItem.values[i]
            };
        }
        Array.prototype.splice.apply(mutatedArray, [offsetIndex(diffItem.index), 0].concat(added));
    });

    var offset = 0;
    mutatedArray.forEach(function (diffItem, index) {
        var type = diffItem.type;
        if (type === 'remove') {
            offset -= 1;
        } else if (type === 'similar') {
            diffItem.expected = expected[offset + index];
        }
    });

    var conflicts = mutatedArray.reduce(function (conflicts, item) {
        return item.type === 'similar' ? conflicts : conflicts + 1;
    }, 0);

    for (var i = 0, c = 0; i < Math.max(actual.length, expected.length) &&  c <= conflicts; i += 1) {
        var expectedType = typeof expected[i];
        var actualType = typeof actual[i];

        if (
            actualType !== expectedType ||
                ((actualType === 'object' || actualType === 'string') && !similar(actual[i], expected[i])) ||
                (actualType !== 'object' && actualType !== 'string' && !equal(actual[i], expected[i]))
        ) {
            c += 1;
        }
    }

    if (c <= conflicts) {
        mutatedArray = [];
        var j;
        for (j = 0; j < Math.min(actual.length, expected.length); j += 1) {
            mutatedArray.push({
                type: 'similar',
                value: actual[j],
                expected: expected[j]
            });
        }

        if (actual.length < expected.length) {
            for (; j < Math.max(actual.length, expected.length); j += 1) {
                mutatedArray.push({
                    type: 'insert',
                    value: expected[j]
                });
            }
        } else {
            for (; j < Math.max(actual.length, expected.length); j += 1) {
                mutatedArray.push({
                    type: 'remove',
                    value: actual[j]
                });
            }
        }
        if (mutatedArray.length > 0) {
            mutatedArray[mutatedArray.length - 1].last = true;
        }
    }

    mutatedArray.forEach(function (diffItem) {
        if (diffItem.type === 'similar' && equal(diffItem.value, diffItem.expected)) {
            diffItem.type = 'equal';
        }
    });

    return mutatedArray;
};

},{"arraydiff":4}],4:[function(require,module,exports){
module.exports = arrayDiff;

// Based on some rough benchmarking, this algorithm is about O(2n) worst case,
// and it can compute diffs on random arrays of length 1024 in about 34ms,
// though just a few changes on an array of length 1024 takes about 0.5ms

arrayDiff.InsertDiff = InsertDiff;
arrayDiff.RemoveDiff = RemoveDiff;
arrayDiff.MoveDiff = MoveDiff;

function InsertDiff(index, values) {
  this.index = index;
  this.values = values;
}
InsertDiff.prototype.type = 'insert';
InsertDiff.prototype.toJSON = function() {
  return {
    type: this.type
  , index: this.index
  , values: this.values
  };
};

function RemoveDiff(index, howMany) {
  this.index = index;
  this.howMany = howMany;
}
RemoveDiff.prototype.type = 'remove';
RemoveDiff.prototype.toJSON = function() {
  return {
    type: this.type
  , index: this.index
  , howMany: this.howMany
  };
};

function MoveDiff(from, to, howMany) {
  this.from = from;
  this.to = to;
  this.howMany = howMany;
}
MoveDiff.prototype.type = 'move';
MoveDiff.prototype.toJSON = function() {
  return {
    type: this.type
  , from: this.from
  , to: this.to
  , howMany: this.howMany
  };
};

function strictEqual(a, b) {
  return a === b;
}

function arrayDiff(before, after, equalFn) {
  if (!equalFn) equalFn = strictEqual;

  // Find all items in both the before and after array, and represent them
  // as moves. Many of these "moves" may end up being discarded in the last
  // pass if they are from an index to the same index, but we don't know this
  // up front, since we haven't yet offset the indices.
  // 
  // Also keep a map of all the indicies accounted for in the before and after
  // arrays. These maps are used next to create insert and remove diffs.
  var beforeLength = before.length;
  var afterLength = after.length;
  var moves = [];
  var beforeMarked = {};
  var afterMarked = {};
  for (var beforeIndex = 0; beforeIndex < beforeLength; beforeIndex++) {
    var beforeItem = before[beforeIndex];
    for (var afterIndex = 0; afterIndex < afterLength; afterIndex++) {
      if (afterMarked[afterIndex]) continue;
      if (!equalFn(beforeItem, after[afterIndex])) continue;
      var from = beforeIndex;
      var to = afterIndex;
      var howMany = 0;
      do {
        beforeMarked[beforeIndex++] = afterMarked[afterIndex++] = true;
        howMany++;
      } while (
        beforeIndex < beforeLength &&
        afterIndex < afterLength &&
        equalFn(before[beforeIndex], after[afterIndex]) &&
        !afterMarked[afterIndex]
      );
      moves.push(new MoveDiff(from, to, howMany));
      beforeIndex--;
      break;
    }
  }

  // Create a remove for all of the items in the before array that were
  // not marked as being matched in the after array as well
  var removes = [];
  for (beforeIndex = 0; beforeIndex < beforeLength;) {
    if (beforeMarked[beforeIndex]) {
      beforeIndex++;
      continue;
    }
    var index = beforeIndex;
    var howMany = 0;
    while (beforeIndex < beforeLength && !beforeMarked[beforeIndex++]) {
      howMany++;
    }
    removes.push(new RemoveDiff(index, howMany));
  }

  // Create an insert for all of the items in the after array that were
  // not marked as being matched in the before array as well
  var inserts = [];
  for (afterIndex = 0; afterIndex < afterLength;) {
    if (afterMarked[afterIndex]) {
      afterIndex++;
      continue;
    }
    var index = afterIndex;
    var howMany = 0;
    while (afterIndex < afterLength && !afterMarked[afterIndex++]) {
      howMany++;
    }
    var values = after.slice(index, index + howMany);
    inserts.push(new InsertDiff(index, values));
  }

  var insertsLength = inserts.length;
  var removesLength = removes.length;
  var movesLength = moves.length;
  var i, j;

  // Offset subsequent removes and moves by removes
  var count = 0;
  for (i = 0; i < removesLength; i++) {
    var remove = removes[i];
    remove.index -= count;
    count += remove.howMany;
    for (j = 0; j < movesLength; j++) {
      var move = moves[j];
      if (move.from >= remove.index) move.from -= remove.howMany;
    }
  }

  // Offset moves by inserts
  for (i = insertsLength; i--;) {
    var insert = inserts[i];
    var howMany = insert.values.length;
    for (j = movesLength; j--;) {
      var move = moves[j];
      if (move.to >= insert.index) move.to -= howMany;
    }
  }

  // Offset the to of moves by later moves
  for (i = movesLength; i-- > 1;) {
    var move = moves[i];
    if (move.to === move.from) continue;
    for (j = i; j--;) {
      var earlier = moves[j];
      if (earlier.to >= move.to) earlier.to -= move.howMany;
      if (earlier.to >= move.from) earlier.to += move.howMany;
    }
  }

  // Only output moves that end up having an effect after offsetting
  var outputMoves = [];

  // Offset the from of moves by earlier moves
  for (i = 0; i < movesLength; i++) {
    var move = moves[i];
    if (move.to === move.from) continue;
    outputMoves.push(move);
    for (j = i + 1; j < movesLength; j++) {
      var later = moves[j];
      if (later.from >= move.from) later.from -= move.howMany;
      if (later.from >= move.to) later.from += move.howMany;
    }
  }

  return removes.concat(outputMoves, inserts);
}

},{}],5:[function(require,module,exports){


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
},{}],6:[function(require,module,exports){
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

},{"../3rdparty/prism":5}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvbWF0Y2hlc1NlbGVjdG9yLmpzIiwibm9kZV9tb2R1bGVzL2FycmF5LWNoYW5nZXMvbGliL2FycmF5Q2hhbmdlcy5qcyIsIm5vZGVfbW9kdWxlcy9hcnJheS1jaGFuZ2VzL25vZGVfbW9kdWxlcy9hcnJheWRpZmYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWFnaWNwZW4tcHJpc20vM3JkcGFydHkvcHJpc20uanMiLCJub2RlX21vZHVsZXMvbWFnaWNwZW4tcHJpc20vbGliL21hZ2ljUGVuUHJpc20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGFycmF5Q2hhbmdlcyA9IHJlcXVpcmUoJ2FycmF5LWNoYW5nZXMnKTtcbnZhciBtYXRjaGVzU2VsZWN0b3IgPSByZXF1aXJlKCcuL21hdGNoZXNTZWxlY3RvcicpO1xuXG5mdW5jdGlvbiBwYXJzZUh0bWwoc3RyLCBpc0ZyYWdtZW50LCBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlKSB7XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgc3RyID0gJzxodG1sPjxoZWFkPjwvaGVhZD48Ym9keT4nICsgc3RyICsgJzwvYm9keT48L2h0bWw+JztcbiAgfVxuICB2YXIgaHRtbERvY3VtZW50O1xuICBpZiAodHlwZW9mIERPTVBhcnNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBodG1sRG9jdW1lbnQgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHN0ciwgJ3RleHQvaHRtbCcpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24gJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KSB7XG4gICAgaHRtbERvY3VtZW50ID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KCcnKTtcbiAgICBodG1sRG9jdW1lbnQub3BlbigpO1xuICAgIGh0bWxEb2N1bWVudC53cml0ZShzdHIpO1xuICAgIGh0bWxEb2N1bWVudC5jbG9zZSgpO1xuICB9IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICBodG1sRG9jdW1lbnQgPSByZXF1aXJlKCdqc2RvbScpLmpzZG9tKHN0cik7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQtZG9tJyArIChhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlID8gJyAoJyArIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UgKyAnKScgOiAnJykgKyAnOiBSdW5uaW5nIG91dHNpZGUgYSBicm93c2VyLCBidXQgY291bGQgbm90IGZpbmQgdGhlIGBqc2RvbWAgbW9kdWxlLiBQbGVhc2UgbnBtIGluc3RhbGwganNkb20gdG8gbWFrZSB0aGlzIHdvcmsuJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgdmFyIGJvZHkgPSBodG1sRG9jdW1lbnQuYm9keTtcbiAgICB2YXIgZG9jdW1lbnRGcmFnbWVudCA9IGh0bWxEb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgaWYgKGJvZHkpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGJvZHkuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgZG9jdW1lbnRGcmFnbWVudC5hcHBlbmRDaGlsZChib2R5LmNoaWxkTm9kZXNbaV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRvY3VtZW50RnJhZ21lbnQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGh0bWxEb2N1bWVudDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZVhtbChzdHIsIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UpIHtcbiAgaWYgKHR5cGVvZiBET01QYXJzZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoc3RyLCAndGV4dC94bWwnKTtcbiAgfSBlbHNlIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHJlcXVpcmUoJ2pzZG9tJykuanNkb20oc3RyLCB7IHBhcnNpbmdNb2RlOiAneG1sJyB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZC1kb20nICsgKGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UgPyAnICgnICsgYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSArICcpJyA6ICcnKSArICc6IFJ1bm5pbmcgb3V0c2lkZSBhIGJyb3dzZXIgKG9yIGluIGEgYnJvd3NlciB3aXRob3V0IERPTVBhcnNlciksIGJ1dCBjb3VsZCBub3QgZmluZCB0aGUgYGpzZG9tYCBtb2R1bGUuIFBsZWFzZSBucG0gaW5zdGFsbCBqc2RvbSB0byBtYWtlIHRoaXMgd29yay4nKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRnJvbSBodG1sLW1pbmlmaWVyXG52YXIgZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlcyA9IHtcbiAgZHJhZ2dhYmxlOiBbJ3RydWUnLCAnZmFsc2UnXSAvLyBkZWZhdWx0cyB0byAnYXV0bydcbn07XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKSB7XG4gIHZhciBpc1NpbXBsZUJvb2xlYW4gPSAoL14oPzphbGxvd2Z1bGxzY3JlZW58YXN5bmN8YXV0b2ZvY3VzfGF1dG9wbGF5fGNoZWNrZWR8Y29tcGFjdHxjb250cm9sc3xkZWNsYXJlfGRlZmF1bHR8ZGVmYXVsdGNoZWNrZWR8ZGVmYXVsdG11dGVkfGRlZmF1bHRzZWxlY3RlZHxkZWZlcnxkaXNhYmxlZHxlbmFibGVkfGZvcm1ub3ZhbGlkYXRlfGhpZGRlbnxpbmRldGVybWluYXRlfGluZXJ0fGlzbWFwfGl0ZW1zY29wZXxsb29wfG11bHRpcGxlfG11dGVkfG5vaHJlZnxub3Jlc2l6ZXxub3NoYWRlfG5vdmFsaWRhdGV8bm93cmFwfG9wZW58cGF1c2VvbmV4aXR8cmVhZG9ubHl8cmVxdWlyZWR8cmV2ZXJzZWR8c2NvcGVkfHNlYW1sZXNzfHNlbGVjdGVkfHNvcnRhYmxlfHNwZWxsY2hlY2t8dHJ1ZXNwZWVkfHR5cGVtdXN0bWF0Y2h8dmlzaWJsZSkkL2kpLnRlc3QoYXR0ck5hbWUpO1xuICBpZiAoaXNTaW1wbGVCb29sZWFuKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgYXR0clZhbHVlRW51bWVyYXRpb24gPSBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzW2F0dHJOYW1lLnRvTG93ZXJDYXNlKCldO1xuICBpZiAoIWF0dHJWYWx1ZUVudW1lcmF0aW9uKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGVsc2Uge1xuICAgIHJldHVybiAoLTEgPT09IGF0dHJWYWx1ZUVudW1lcmF0aW9uLmluZGV4T2YoYXR0clZhbHVlLnRvTG93ZXJDYXNlKCkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHlsZVN0cmluZ1RvT2JqZWN0KHN0cikge1xuICB2YXIgc3R5bGVzID0ge307XG5cbiAgc3RyLnNwbGl0KCc7JykuZm9yRWFjaChmdW5jdGlvbiAocnVsZSkge1xuICAgIHZhciB0dXBsZSA9IHJ1bGUuc3BsaXQoJzonKS5tYXAoZnVuY3Rpb24gKHBhcnQpIHsgcmV0dXJuIHBhcnQudHJpbSgpOyB9KTtcblxuICAgIC8vIEd1YXJkIGFnYWluc3QgZW1wdHkgdG91cGxlc1xuICAgIGlmICh0dXBsZVswXSAmJiB0dXBsZVsxXSkge1xuICAgICAgc3R5bGVzW3R1cGxlWzBdXSA9IHR1cGxlWzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSkge1xuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICB2YXIgY2xhc3NOYW1lcyA9IGF0dHJpYnV0ZVZhbHVlLnNwbGl0KC9cXHMrLyk7XG4gIGlmIChjbGFzc05hbWVzLmxlbmd0aCA9PT0gMSAmJiBjbGFzc05hbWVzWzBdID09PSAnJykge1xuICAgIGNsYXNzTmFtZXMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIGNsYXNzTmFtZXM7XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZXMoZWxlbWVudCkge1xuICB2YXIgaXNIdG1sID0gZWxlbWVudC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgdmFyIGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChhdHRyc1tpXS5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBhdHRyc1tpXS52YWx1ZSAmJiBhdHRyc1tpXS52YWx1ZS5zcGxpdCgnICcpIHx8IFtdO1xuICAgIH0gZWxzZSBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gc3R5bGVTdHJpbmdUb09iamVjdChhdHRyc1tpXS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cnNbaV0ubmFtZSkgPyB0cnVlIDogKGF0dHJzW2ldLnZhbHVlIHx8ICcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBlbnRpdGlmeSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpIHtcbiAgcmV0dXJuICgvKD86YXJlYXxiYXNlfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKS9pKS50ZXN0KGVsZW1lbnROYW1lKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgdmFsdWUsIGlzSHRtbCkge1xuICBvdXRwdXQucHJpc21BdHRyTmFtZShhdHRyaWJ1dGVOYW1lKTtcbiAgaWYgKCFpc0h0bWwgfHwgIWlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSkge1xuICAgIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLmpvaW4oJyAnKTtcbiAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgIHZhbHVlID0gT2JqZWN0LmtleXModmFsdWUpLm1hcChmdW5jdGlvbiAoY3NzUHJvcCkge1xuICAgICAgICByZXR1cm4gY3NzUHJvcCArICc6ICcgKyB2YWx1ZVtjc3NQcm9wXTtcbiAgICAgIH0pLmpvaW4oJzsgJyk7XG4gICAgfVxuICAgIG91dHB1dFxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJz1cIicpXG4gICAgICAucHJpc21BdHRyVmFsdWUoZW50aXRpZnkodmFsdWUpKVxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJ1wiJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZTtcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgcmV0dXJuICdjbGFzcz1cIicgKyB2YWx1ZS5qb2luKCcgJykgKyAnXCInOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgcmV0dXJuICdzdHlsZT1cIicgKyBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKGZ1bmN0aW9uIChjc3NQcm9wKSB7XG4gICAgICByZXR1cm4gW2Nzc1Byb3AsIHZhbHVlW2Nzc1Byb3BdXS5qb2luKCc6ICcpOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgICB9KS5qb2luKCc7ICcpICsgJ1wiJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZSArICc9XCInICsgZW50aXRpZnkodmFsdWUpICsgJ1wiJztcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCcgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICB2YXIgc3RyID0gJzwnICsgZWxlbWVudE5hbWU7XG4gIHZhciBhdHRycyA9IGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCk7XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHN0ciArPSAnICcgKyBzdHJpbmdpZnlBdHRyaWJ1dGUoa2V5LCBhdHRyc1trZXldKTtcbiAgfSk7XG5cbiAgc3RyICs9ICc+JztcbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gIHZhciBlbGVtZW50TmFtZSA9IGlzSHRtbCA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG4gIGlmIChpc0h0bWwgJiYgaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkgJiYgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJzwvJyArIGVsZW1lbnROYW1lICsgJz4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRpZmZOb2RlTGlzdHMoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICB2YXIgY2hhbmdlcyA9IGFycmF5Q2hhbmdlcyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhY3R1YWwpLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChleHBlY3RlZCksIGVxdWFsLCBmdW5jdGlvbiAoYSwgYikge1xuICAgIC8vIEZpZ3VyZSBvdXQgd2hldGhlciBhIGFuZCBiIGFyZSBcInN0cnV0dXJhbGx5IHNpbWlsYXJcIiBzbyB0aGV5IGNhbiBiZSBkaWZmZWQgaW5saW5lLlxuICAgIHJldHVybiAoXG4gICAgICBhLm5vZGVUeXBlID09PSAxICYmIGIubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgIGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWVcbiAgICApO1xuICB9KTtcblxuICBjaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtLCBpbmRleCkge1xuICAgIG91dHB1dC5pKCkuYmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHR5cGUgPSBkaWZmSXRlbS50eXBlO1xuICAgICAgaWYgKHR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgIHRoaXMuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdtaXNzaW5nICcpLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkuc3AoKS5lcnJvcignLy8gc2hvdWxkIGJlIHJlbW92ZWQnKSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdlcXVhbCcpIHtcbiAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgdmFsdWVEaWZmID0gZGlmZihkaWZmSXRlbS52YWx1ZSwgZGlmZkl0ZW0uZXhwZWN0ZWQpO1xuICAgICAgICBpZiAodmFsdWVEaWZmICYmIHZhbHVlRGlmZi5pbmxpbmUpIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKHZhbHVlRGlmZi5kaWZmKTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZURpZmYpIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNob3VsZEVxdWFsRXJyb3IoZGlmZkl0ZW0uZXhwZWN0ZWQsIGluc3BlY3QpLm5sKCkuYXBwZW5kKHZhbHVlRGlmZi5kaWZmKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNob3VsZEVxdWFsRXJyb3IoZGlmZkl0ZW0uZXhwZWN0ZWQsIGluc3BlY3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkubmwoaW5kZXggPCBjaGFuZ2VzLmxlbmd0aCAtIDEgPyAxIDogMCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbmFtZTogJ3VuZXhwZWN0ZWQtZG9tJyxcbiAgaW5zdGFsbEludG86IGZ1bmN0aW9uIChleHBlY3QpIHtcbiAgICBleHBlY3QuaW5zdGFsbFBsdWdpbihyZXF1aXJlKCdtYWdpY3Blbi1wcmlzbScpKTtcbiAgICB2YXIgdG9wTGV2ZWxFeHBlY3QgPSBleHBlY3Q7XG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGUnLFxuICAgICAgYmFzZTogJ29iamVjdCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlTmFtZSAmJiBbMiwgMywgNCwgNSwgNiwgNywgMTAsIDExLCAxMl0uaW5kZXhPZihvYmoubm9kZVR5cGUpID4gLTE7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVsZW1lbnQubm9kZU5hbWUgKyAnIFwiJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJ1wiJywgJ3ByaXNtLXN0cmluZycpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUNvbW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDg7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKCc8IS0tJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJy0tPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IS0tJyArIGFjdHVhbC5ub2RlVmFsdWUgKyAnLS0+JywgJzwhLS0nICsgZXhwZWN0ZWQubm9kZVZhbHVlICsgJy0tPicpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTVRleHROb2RlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUudHJpbSgpID09PSBiLm5vZGVWYWx1ZS50cmltKCk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVudGl0aWZ5KGVsZW1lbnQubm9kZVZhbHVlLnRyaW0oKSksICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKGFjdHVhbC5ub2RlVmFsdWUsIGV4cGVjdGVkLm5vZGVWYWx1ZSk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NTm9kZUxpc3QnLFxuICAgICAgYmFzZTogJ2FycmF5LWxpa2UnLFxuICAgICAgcHJlZml4OiBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnTm9kZUxpc3RbJyk7XG4gICAgICB9LFxuICAgICAgc3VmZml4OiBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnXScpO1xuICAgICAgfSxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgb2JqICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5sZW5ndGggPT09ICdudW1iZXInICYmXG4gICAgICAgICAgdHlwZW9mIG9iai50b1N0cmluZyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIHR5cGVvZiBvYmouaXRlbSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIG9iai50b1N0cmluZygpLmluZGV4T2YoJ05vZGVMaXN0JykgIT09IC0xXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBGYWtlIHR5cGUgdG8gbWFrZSBpdCBwb3NzaWJsZSB0byBidWlsZCAndG8gc2F0aXNmeScgZGlmZnMgdG8gYmUgcmVuZGVyZWQgaW5saW5lOlxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdhdHRhY2hlZERPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdhcnJheS1saWtlJyxcbiAgICAgIHByZWZpeDogZnVuY3Rpb24gKG91dHB1dCkgeyByZXR1cm4gb3V0cHV0OyB9LFxuICAgICAgc3VmZml4OiBmdW5jdGlvbiAob3V0cHV0KSB7IHJldHVybiBvdXRwdXQ7IH0sXG4gICAgICBkZWxpbWl0ZXI6IGZ1bmN0aW9uIChvdXRwdXQpIHsgcmV0dXJuIG91dHB1dDsgfSxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLl9pc0F0dGFjaGVkRE9NTm9kZUxpc3Q7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnSFRNTERvY1R5cGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDEwICYmICdwdWJsaWNJZCcgaW4gb2JqO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChkb2N0eXBlLCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8IURPQ1RZUEUgJyArIGRvY3R5cGUubmFtZSArICc+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IURPQ1RZUEUgJyArIGFjdHVhbC5uYW1lICsgJz4nLCAnPCFET0NUWVBFICcgKyBleHBlY3RlZC5uYW1lICsgJz4nKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Eb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gOSAmJiBvYmouZG9jdW1lbnRFbGVtZW50ICYmIG9iai5pbXBsZW1lbnRhdGlvbjtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmFzZVR5cGUuaWRlbnRpZnkob2JqKSAmJiBvYmouY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ1hNTERvY3VtZW50JyxcbiAgICAgIGJhc2U6ICdET01Eb2N1bWVudCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIC9eKD86YXBwbGljYXRpb258dGV4dClcXC94bWx8XFwreG1sXFxiLy50ZXN0KG9iai5jb250ZW50VHlwZSk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8P3htbCB2ZXJzaW9uPVwiMS4wXCI/PicsICd4bWwnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSwgZGVwdGggLSAxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Eb2N1bWVudEZyYWdtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxMTsgLy8gSW4ganNkb20sIGRvY3VtZW50RnJhZ21lbnQudG9TdHJpbmcoKSBkb2VzIG5vdCByZXR1cm4gW29iamVjdCBEb2N1bWVudEZyYWdtZW50XVxuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChkb2N1bWVudEZyYWdtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC50ZXh0KCdEb2N1bWVudEZyYWdtZW50WycpLmFwcGVuZChpbnNwZWN0KGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2RlcywgZGVwdGgpKS50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUVsZW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDEgJiYgb2JqLm5vZGVOYW1lICYmIG9iai5hdHRyaWJ1dGVzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYiwgZXF1YWwpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gYi5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICYmIGVxdWFsKGdldEF0dHJpYnV0ZXMoYSksIGdldEF0dHJpYnV0ZXMoYikpICYmIGVxdWFsKGEuY2hpbGROb2RlcywgYi5jaGlsZE5vZGVzKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBzdGFydFRhZyA9IHN0cmluZ2lmeVN0YXJ0VGFnKGVsZW1lbnQpO1xuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0YXJ0VGFnLCAnaHRtbCcpO1xuICAgICAgICBpZiAoZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgIGlmIChkZXB0aCA9PT0gMSkge1xuICAgICAgICAgICAgICBvdXRwdXQudGV4dCgnLi4uJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBpbnNwZWN0ZWRDaGlsZHJlbiA9IFtdO1xuICAgICAgICAgICAgaWYgKGVsZW1lbnROYW1lID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgICB2YXIgdHlwZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJyk7XG4gICAgICAgICAgICAgIGlmICghdHlwZSB8fCAvamF2YXNjcmlwdC8udGVzdCh0eXBlKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnamF2YXNjcmlwdCc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIHR5cGUpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJykgfHwgJ3RleHQvY3NzJykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2goaW5zcGVjdChlbGVtZW50LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd2lkdGggPSAwO1xuICAgICAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgIHZhciBzaXplID0gby5zaXplKCk7XG4gICAgICAgICAgICAgIHdpZHRoICs9IHNpemUud2lkdGg7XG4gICAgICAgICAgICAgIHJldHVybiB3aWR0aCA+IDUwIHx8IG8uaGVpZ2h0ID4gMTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAobXVsdGlwbGVMaW5lcykge1xuICAgICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuXG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5pKCkuYmxvY2soaW5zcGVjdGVkQ2hpbGQpLm5sKCk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIG91dHB1dC5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdGVkQ2hpbGQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIGRpZmZMaW1pdDogNTEyLFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGlzSHRtbCA9IGFjdHVhbC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBkaWZmOiBvdXRwdXQsXG4gICAgICAgICAgaW5saW5lOiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCkgPiB0aGlzLmRpZmZMaW1pdCkge1xuICAgICAgICAgIHJlc3VsdC5kaWZmLmpzQ29tbWVudCgnRGlmZiBzdXBwcmVzc2VkIGR1ZSB0byBzaXplID4gJyArIHRoaXMuZGlmZkxpbWl0KTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVtcHR5RWxlbWVudHMgPSBhY3R1YWwuY2hpbGROb2Rlcy5sZW5ndGggPT09IDAgJiYgZXhwZWN0ZWQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDA7XG4gICAgICAgIHZhciBjb25mbGljdGluZ0VsZW1lbnQgPSBhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAhPT0gZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSB8fCAhZXF1YWwoZ2V0QXR0cmlidXRlcyhhY3R1YWwpLCBnZXRBdHRyaWJ1dGVzKGV4cGVjdGVkKSk7XG5cbiAgICAgICAgaWYgKGNvbmZsaWN0aW5nRWxlbWVudCkge1xuICAgICAgICAgIHZhciBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgLnByaXNtUHVuY3R1YXRpb24oJzwnKVxuICAgICAgICAgICAgLnByaXNtVGFnKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICBpZiAoYWN0dWFsLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgIT09IGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ3Nob3VsZCBiZScpLnNwKCkucHJpc21UYWcoZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBhY3R1YWxBdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhhY3R1YWwpO1xuICAgICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZXMgPSBnZXRBdHRyaWJ1dGVzKGV4cGVjdGVkKTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhhY3R1YWxBdHRyaWJ1dGVzKS5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoY2FuQ29udGludWVMaW5lID8gMSA6IDIgKyBhY3R1YWwubm9kZU5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihvdXRwdXQsIGF0dHJpYnV0ZU5hbWUsIGFjdHVhbEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0sIGlzSHRtbCk7XG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlTmFtZSBpbiBleHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgaWYgKGFjdHVhbEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0gPT09IGV4cGVjdGVkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkge1xuICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IHRydWU7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnNwKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ3Nob3VsZCBlcXVhbCcpLnNwKCkuYXBwZW5kKGluc3BlY3QoZW50aXRpZnkoZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdKSkpO1xuICAgICAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVsZXRlIGV4cGVjdGVkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlIHJlbW92ZWQnKTtcbiAgICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXhwZWN0ZWRBdHRyaWJ1dGVzKS5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoY2FuQ29udGludWVMaW5lID8gMSA6IDIgKyBhY3R1YWwubm9kZU5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgIG91dHB1dC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICB0aGlzLmVycm9yKCdtaXNzaW5nJykuc3AoKTtcbiAgICAgICAgICAgICAgd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKHRoaXMsIGF0dHJpYnV0ZU5hbWUsIGV4cGVjdGVkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSwgaXNIdG1sKTtcbiAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeVN0YXJ0VGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVtcHR5RWxlbWVudHMpIHtcbiAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuICAgICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICAgIG91dHB1dC5ubCgpLm91dGRlbnRMaW5lcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01FbGVtZW50JywgJ3RvIFtvbmx5XSBoYXZlIChjbGFzc3xjbGFzc2VzKScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgZmxhZ3MgPSB0aGlzLmZsYWdzO1xuICAgICAgaWYgKGZsYWdzLm9ubHkpIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywge1xuICAgICAgICAgIGNsYXNzOiBmdW5jdGlvbiAoY2xhc3NOYW1lKSB7XG4gICAgICAgICAgICB2YXIgYWN0dWFsQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZSh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZmxhZ3Mub25seSkge1xuICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYWN0dWFsQ2xhc3Nlcy5zb3J0KCksICd0byBlcXVhbCcsIHZhbHVlLnNvcnQoKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QuYXBwbHkodG9wTGV2ZWxFeHBlY3QsIFthY3R1YWxDbGFzc2VzLCAndG8gY29udGFpbiddLmNvbmNhdCh2YWx1ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBoYXZlIGF0dHJpYnV0ZXMnLCB7IGNsYXNzOiB2YWx1ZSB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTVRleHROb2RlJywgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0Lm5vZGVWYWx1ZSwgJ3RvIHNhdGlzZnknLCBleHBlY3QuZmluZFR5cGVPZih2YWx1ZSkubmFtZSA9PT0gJ0RPTVRleHROb2RlJyA/IHZhbHVlLm5vZGVWYWx1ZSA6IHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhub2RlLCBpc0h0bWwpIHtcbiAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSAxKSB7XG4gICAgICAgIC8vIERPTUVsZW1lbnRcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBuYW1lOiBpc0h0bWwgPyBub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBub2RlLm5vZGVOYW1lLFxuICAgICAgICAgIGF0dHJpYnV0ZXM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5hdHRyaWJ1dGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzW25vZGUuYXR0cmlidXRlc1tpXS5uYW1lXSA9IGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUobm9kZS5hdHRyaWJ1dGVzW2ldLm5hbWUpID8gdHJ1ZSA6IChub2RlLmF0dHJpYnV0ZXNbaV0udmFsdWUgfHwgJycpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChub2RlLmNoaWxkTm9kZXMsIGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGVsc2UgaWYgKG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgLy8gRE9NVGV4dE5vZGVcbiAgICAgICAgcmV0dXJuIG5vZGUubm9kZVZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0byBzYXRpc2Z5OiBOb2RlIHR5cGUgJyArIG5vZGUubm9kZVR5cGUgKyAnIGlzIG5vdCB5ZXQgc3VwcG9ydGVkIGluIHRoZSB2YWx1ZScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTURvY3VtZW50RnJhZ21lbnQnLCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgaXNIdG1sID0gc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgIHZhciB2YWx1ZVR5cGUgPSBleHBlY3QuZmluZFR5cGVPZih2YWx1ZSk7XG4gICAgICBpZiAodmFsdWVUeXBlLm5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHZhciBvcmlnaW5hbFZhbHVlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuYXJnc091dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICBvdXRwdXQuY29kZShvcmlnaW5hbFZhbHVlLCBpc0h0bWwgPyAnaHRtbCcgOiAneG1sJyk7XG4gICAgICAgIH07XG4gICAgICAgIHZhbHVlID0gaXNIdG1sID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbikgOiBwYXJzZVhtbCh2YWx1ZSwgdGhpcy50ZXN0RGVzY3JpcHRpb24pO1xuICAgICAgfVxuXG4gICAgICBpZiAodmFsdWUgJiYgdmFsdWUubm9kZVR5cGUgPT09IDExKSB7XG4gICAgICAgIHZhbHVlID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHZhbHVlLmNoaWxkTm9kZXMsIGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKGNoaWxkTm9kZSwgaXNIdG1sKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5jaGlsZE5vZGVzLCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTUVsZW1lbnQnLCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgaXNIdG1sID0gc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHZhciBkb2N1bWVudEZyYWdtZW50ID0gaXNIdG1sID8gcGFyc2VIdG1sKHZhbHVlLCB0cnVlLCB0aGlzLnRlc3REZXNjcmlwdGlvbikgOiBwYXJzZVhtbCh2YWx1ZSwgdGhpcy50ZXN0RGVzY3JpcHRpb24pO1xuICAgICAgICBpZiAoZG9jdW1lbnRGcmFnbWVudC5jaGlsZE5vZGVzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSFRNTEVsZW1lbnQgdG8gc2F0aXNmeSBzdHJpbmc6IE9ubHkgYSBzaW5nbGUgbm9kZSBpcyBzdXBwb3J0ZWQnKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3JpZ2luYWxWYWx1ZSA9IHZhbHVlO1xuICAgICAgICB2YWx1ZSA9IGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2Rlc1swXTtcbiAgICAgICAgdGhpcy5hcmdzT3V0cHV0ID0gZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgIG91dHB1dC5jb2RlKG9yaWdpbmFsVmFsdWUsIGlzSHRtbCA/ICdodG1sJyA6ICd4bWwnKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChleHBlY3QuZmluZFR5cGVPZih2YWx1ZSkubmFtZSA9PT0gJ0RPTUVsZW1lbnQnKSB7XG4gICAgICAgIHZhbHVlID0gY29udmVydERPTU5vZGVUb1NhdGlzZnlTcGVjKHZhbHVlLCBpc0h0bWwpO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdmFyIHVuc3VwcG9ydGVkT3B0aW9ucyA9IE9iamVjdC5rZXlzKHZhbHVlKS5maWx0ZXIoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgIHJldHVybiBrZXkgIT09ICdhdHRyaWJ1dGVzJyAmJiBrZXkgIT09ICduYW1lJyAmJiBrZXkgIT09ICdjaGlsZHJlbicgJiYga2V5ICE9PSAnb25seUF0dHJpYnV0ZXMnICYmIGtleSAhPT0gJ3RleHRDb250ZW50JztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh1bnN1cHBvcnRlZE9wdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgb3B0aW9uJyArICh1bnN1cHBvcnRlZE9wdGlvbnMubGVuZ3RoID09PSAxID8gJycgOiAncycpICsgJzogJyArIHVuc3VwcG9ydGVkT3B0aW9ucy5qb2luKCcsICcpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgcHJvbWlzZUJ5S2V5ID0ge1xuICAgICAgICBuYW1lOiBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZS5uYW1lICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWUsICd0byBzYXRpc2Z5JywgdmFsdWUubmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgY2hpbGRyZW46IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlLmNoaWxkcmVuICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS50ZXh0Q29udGVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgY2hpbGRyZW4gYW5kIHRleHRDb250ZW50IHByb3BlcnRpZXMgYXJlIG5vdCBzdXBwb3J0ZWQgdG9nZXRoZXInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBub2RlTGlzdEZvckRpZmZpbmcgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IHN1YmplY3QuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgbm9kZUxpc3RGb3JEaWZmaW5nLnB1c2goc3ViamVjdC5jaGlsZE5vZGVzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGVMaXN0Rm9yRGlmZmluZy5faXNBdHRhY2hlZERPTU5vZGVMaXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChub2RlTGlzdEZvckRpZmZpbmcsICd0byBzYXRpc2Z5JywgdmFsdWUuY2hpbGRyZW4pO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlLnRleHRDb250ZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KHN1YmplY3QudGV4dENvbnRlbnQsICd0byBzYXRpc2Z5JywgdmFsdWUudGV4dENvbnRlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIGF0dHJpYnV0ZXM6IHt9XG4gICAgICB9O1xuXG4gICAgICB2YXIgb25seUF0dHJpYnV0ZXMgPSB2YWx1ZSAmJiB2YWx1ZS5vbmx5QXR0cmlidXRlcyB8fCB0aGlzLmZsYWdzLmV4aGF1c3RpdmVseTtcbiAgICAgIHZhciBhdHRycyA9IGdldEF0dHJpYnV0ZXMoc3ViamVjdCk7XG4gICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gdmFsdWUgJiYgdmFsdWUuYXR0cmlidXRlcztcbiAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzID0gW107XG5cbiAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZXMgPSBbZXhwZWN0ZWRBdHRyaWJ1dGVzXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSA9IHt9O1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShleHBlY3RlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gPSB0cnVlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkQXR0cmlidXRlcyAmJiB0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUgPSBleHBlY3RlZEF0dHJpYnV0ZXM7XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmtleXMoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSkuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMucHVzaChhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgdmFyIGF0dHJpYnV0ZVZhbHVlID0gc3ViamVjdC5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUgPSBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gZXhwZWN0LnByb21pc2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdjbGFzcycgJiYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSAnc3RyaW5nJyB8fCBBcnJheS5pc0FycmF5KGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpKSkge1xuICAgICAgICAgICAgICB2YXIgYWN0dWFsQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoYXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgICB2YXIgZXhwZWN0ZWRDbGFzc2VzID0gZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZTtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZENsYXNzZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRDbGFzc2VzID0gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAob25seUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYWN0dWFsQ2xhc3Nlcy5zb3J0KCksICd0byBlcXVhbCcsIGV4cGVjdGVkQ2xhc3Nlcy5zb3J0KCkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdC5hcHBseSh0b3BMZXZlbEV4cGVjdCwgW2FjdHVhbENsYXNzZXMsICd0byBjb250YWluJ10uY29uY2F0KGV4cGVjdGVkQ2xhc3NlcykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkU3R5bGVPYmo7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZFN0eWxlT2JqID0gc3R5bGVTdHJpbmdUb09iamVjdChleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZFN0eWxlT2JqID0gZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChhdHRycy5zdHlsZSwgJ3RvIGV4aGF1c3RpdmVseSBzYXRpc2Z5JywgZXhwZWN0ZWRTdHlsZU9iaik7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGF0dHJzLnN0eWxlLCAndG8gc2F0aXNmeScsIGV4cGVjdGVkU3R5bGVPYmopO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkQXR0cmlidXRlVmFsdWUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgdG9wTGV2ZWxFeHBlY3Qoc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksICd0byBiZSB0cnVlJyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICB0b3BMZXZlbEV4cGVjdChzdWJqZWN0Lmhhc0F0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSwgJ3RvIGJlIGZhbHNlJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYXR0cmlidXRlVmFsdWUsICd0byBzYXRpc2Z5JywgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVQcmVzZW5jZSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkID0gW107XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ25vdCB0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkLnB1c2goYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ3RvIGhhdmUga2V5JywgYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBleHBlY3QoT2JqZWN0LmtleXMoYXR0cnMpLnNvcnQoKSwgJ3RvIGVxdWFsJywgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkLnNvcnQoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV4cGVjdC5wcm9taXNlLmFsbChwcm9taXNlQnlLZXkpLmNhdWdodChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBleHBlY3QucHJvbWlzZS5zZXR0bGUocHJvbWlzZUJ5S2V5KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBleHBlY3QuZmFpbCh7XG4gICAgICAgICAgICBkaWZmOiBmdW5jdGlvbiAob3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICAgICAgICBvdXRwdXQuYmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBvdXRwdXQgPSB0aGlzO1xuICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgLnByaXNtUHVuY3R1YXRpb24oJzwnKVxuICAgICAgICAgICAgICAgICAgLnByaXNtVGFnKGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWUpO1xuICAgICAgICAgICAgICAgIHZhciBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChwcm9taXNlQnlLZXkubmFtZS5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBuYW1lRXJyb3IgPSBwcm9taXNlQnlLZXkubmFtZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoKG5hbWVFcnJvciAmJiBuYW1lRXJyb3IuZ2V0TGFiZWwoKSkgfHwgJ3Nob3VsZCBzYXRpc2Z5JylcbiAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoaW5zcGVjdCh2YWx1ZS5uYW1lKSk7XG4gICAgICAgICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IHByb21pc2VCeUtleS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgc3ViamVjdC5ub2RlTmFtZS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgYXR0cnNbYXR0cmlidXRlTmFtZV0sIGlzSHRtbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoKHByb21pc2UgJiYgcHJvbWlzZS5pc0Z1bGZpbGxlZCgpKSB8fCAoIXByb21pc2UgJiYgKCFvbmx5QXR0cmlidXRlcyB8fCBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgIT09IC0xKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvbWlzZSAmJiB0eXBlb2YgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQocHJvbWlzZS5yZWFzb24oKS5nZXRFcnJvck1lc3NhZ2UodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seUF0dHJpYnV0ZXMgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlIHJlbW92ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwcm9taXNlIHx8IHByb21pc2UuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHByb21pc2UgJiYgcHJvbWlzZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3AoMiArIHN1YmplY3Qubm9kZU5hbWUubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoJ21pc3NpbmcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByaXNtQXR0ck5hbWUoYXR0cmlidXRlTmFtZSwgJ2h0bWwnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lcnJvcigoZXJyICYmIGVyci5nZXRMYWJlbCgpKSB8fCAnc2hvdWxkIHNhdGlzZnknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKGluc3BlY3QoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm5sKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnByaXNtUHVuY3R1YXRpb24oJz4nKTtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGRyZW5FcnJvciA9IHByb21pc2VCeUtleS5jaGlsZHJlbi5pc1JlamVjdGVkKCkgJiYgcHJvbWlzZUJ5S2V5LmNoaWxkcmVuLnJlYXNvbigpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgY2hpbGRyZW5EaWZmID0gY2hpbGRyZW5FcnJvci5nZXREaWZmKG91dHB1dCk7XG4gICAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5EaWZmICYmIGNoaWxkcmVuRGlmZi5pbmxpbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoY2hpbGRyZW5EaWZmLmRpZmYpO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgLm5sKClcbiAgICAgICAgICAgICAgICAgICAgICAuaW5kZW50TGluZXMoKVxuICAgICAgICAgICAgICAgICAgICAgIC5pKCkuYmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgc3ViamVjdC5jaGlsZE5vZGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZChpbnNwZWN0KHN1YmplY3QuY2hpbGROb2Rlc1tpXSkpLm5sKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoY2hpbGRyZW5FcnJvci5nZXRFcnJvck1lc3NhZ2UodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0Lm5sKCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IHN1YmplY3QuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKHN1YmplY3QpLCAnaHRtbCcpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01FbGVtZW50JywgJ3RvIFtvbmx5XSBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcyknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAzKSB7XG4gICAgICAgICAgdmFsdWUgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndG8gaGF2ZSBhdHRyaWJ1dGVzOiBBcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLCBhbiBhcnJheSwgb3IgYW4gb2JqZWN0Jyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBzYXRpc2Z5JywgeyBhdHRyaWJ1dGVzOiB2YWx1ZSwgb25seUF0dHJpYnV0ZXM6IHRoaXMuZmxhZ3Mub25seSB9KTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTUVsZW1lbnQnLCAndG8gaGF2ZSBbbm9dIChjaGlsZHxjaGlsZHJlbiknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSwgY21wKSB7XG4gICAgICBpZiAodGhpcy5mbGFncy5ubykge1xuICAgICAgICB0aGlzLmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgICByZXR1cm4gZXhwZWN0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHN1YmplY3QuY2hpbGROb2RlcyksICd0byBiZSBhbiBlbXB0eSBhcnJheScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KSk7XG4gICAgICAgIHRocm93IGNoaWxkcmVuO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignRE9NRWxlbWVudCcsICd0byBoYXZlIHRleHQnLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LnRleHRDb250ZW50LCAndG8gc2F0aXNmeScsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oWydET01Eb2N1bWVudCcsICdET01FbGVtZW50J10sICdxdWVyaWVkIGZvciBbZmlyc3RdJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBxdWVyeVJlc3VsdDtcblxuICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcblxuICAgICAgaWYgKHRoaXMuZmxhZ3MuZmlyc3QpIHtcbiAgICAgICAgcXVlcnlSZXN1bHQgPSBzdWJqZWN0LnF1ZXJ5U2VsZWN0b3IodmFsdWUpO1xuICAgICAgICBpZiAoIXF1ZXJ5UmVzdWx0KSB7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgb3V0cHV0LmVycm9yKCdUaGUgc2VsZWN0b3InKS5zcCgpLmpzU3RyaW5nKHZhbHVlKS5zcCgpLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcXVlcnlSZXN1bHQgPSBzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwodmFsdWUpO1xuICAgICAgICBpZiAocXVlcnlSZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgb3V0cHV0LmVycm9yKCdUaGUgc2VsZWN0b3InKS5zcCgpLmpzU3RyaW5nKHZhbHVlKS5zcCgpLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc2hpZnQoZXhwZWN0LCBxdWVyeVJlc3VsdCwgMSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKFsnRE9NRG9jdW1lbnQnLCAnRE9NRWxlbWVudCddLCAndG8gY29udGFpbiBbbm9dIGVsZW1lbnRzIG1hdGNoaW5nJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIGlmICh0aGlzLmZsYWdzLm5vKSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHZhbHVlKSwgJ3RvIHNhdGlzZnknLCBbXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QucXVlcnlTZWxlY3RvckFsbCh2YWx1ZSksICdub3QgdG8gc2F0aXNmeScsIFtdKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oWydET01Eb2N1bWVudCcsICdET01FbGVtZW50J10sICdbbm90XSB0byBtYXRjaCcsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KG1hdGNoZXNTZWxlY3RvcihzdWJqZWN0LCB2YWx1ZSksICd0byBiZScsICh0aGlzLmZsYWdzLm5vdCA/IGZhbHNlIDogdHJ1ZSkpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignc3RyaW5nJywgJ3doZW4gcGFyc2VkIGFzIChodG1sfEhUTUwpIFtmcmFnbWVudF0nLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0KSB7XG4gICAgICB0aGlzLmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgcmV0dXJuIHRoaXMuc2hpZnQoZXhwZWN0LCBwYXJzZUh0bWwoc3ViamVjdCwgdGhpcy5mbGFncy5mcmFnbWVudCwgdGhpcy50ZXN0RGVzY3JpcHRpb24pLCAwKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ3N0cmluZycsICd3aGVuIHBhcnNlZCBhcyAoeG1sfFhNTCknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0KSB7XG4gICAgICB0aGlzLmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgcmV0dXJuIHRoaXMuc2hpZnQoZXhwZWN0LCBwYXJzZVhtbChzdWJqZWN0LCB0aGlzLnRlc3REZXNjcmlwdGlvbiksIDApO1xuICAgIH0pO1xuICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZWxtLCBzZWxlY3Rvcikge1xuICB2YXIgbWF0Y2hGdW50aW9uID0gZWxtLm1hdGNoZXNTZWxlY3RvciB8fFxuICAgIGVsbS5tb3pNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ubXNNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ub01hdGNoZXNTZWxlY3RvciB8fFxuICAgIGVsbS53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgIHZhciBub2RlID0gdGhpcztcbiAgICAgIHZhciBub2RlcyA9IChub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5kb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICB2YXIgaSA9IDA7XG5cbiAgICAgIHdoaWxlIChub2Rlc1tpXSAmJiBub2Rlc1tpXSAhPT0gbm9kZSkge1xuICAgICAgICBpICs9IDE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAhIW5vZGVzW2ldO1xuICAgIH07XG5cbiAgcmV0dXJuIG1hdGNoRnVudGlvbi5jYWxsKGVsbSwgc2VsZWN0b3IpO1xufTtcbiIsInZhciBhcnJheURpZmYgPSByZXF1aXJlKCdhcnJheWRpZmYnKTtcblxuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCkge1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhcnJheUNoYW5nZXMoYWN0dWFsLCBleHBlY3RlZCwgZXF1YWwsIHNpbWlsYXIpIHtcbiAgICB2YXIgbXV0YXRlZEFycmF5ID0gbmV3IEFycmF5KGFjdHVhbC5sZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBhY3R1YWwubGVuZ3RoOyBrICs9IDEpIHtcbiAgICAgICAgbXV0YXRlZEFycmF5W2tdID0ge1xuICAgICAgICAgICAgdHlwZTogJ3NpbWlsYXInLFxuICAgICAgICAgICAgdmFsdWU6IGFjdHVhbFtrXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmIChtdXRhdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICBtdXRhdGVkQXJyYXlbbXV0YXRlZEFycmF5Lmxlbmd0aCAtIDFdLmxhc3QgPSB0cnVlO1xuICAgIH1cblxuICAgIHNpbWlsYXIgPSBzaW1pbGFyIHx8IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgdmFyIGl0ZW1zRGlmZiA9IGFycmF5RGlmZihbXS5jb25jYXQoYWN0dWFsKSwgW10uY29uY2F0KGV4cGVjdGVkKSwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGVxdWFsKGEsIGIpIHx8IHNpbWlsYXIoYSwgYik7XG4gICAgfSk7XG5cbiAgICB2YXIgcmVtb3ZlVGFibGUgPSBbXTtcbiAgICBmdW5jdGlvbiBvZmZzZXRJbmRleChpbmRleCkge1xuICAgICAgICByZXR1cm4gaW5kZXggKyAocmVtb3ZlVGFibGVbaW5kZXggLSAxXSB8fCAwKTtcbiAgICB9XG5cbiAgICB2YXIgcmVtb3ZlcyA9IGl0ZW1zRGlmZi5maWx0ZXIoZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHJldHVybiBkaWZmSXRlbS50eXBlID09PSAncmVtb3ZlJztcbiAgICB9KTtcblxuICAgIHZhciByZW1vdmVzQnlJbmRleCA9IHt9O1xuICAgIHZhciByZW1vdmVkSXRlbXMgPSAwO1xuICAgIHJlbW92ZXMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgdmFyIHJlbW92ZUluZGV4ID0gcmVtb3ZlZEl0ZW1zICsgZGlmZkl0ZW0uaW5kZXg7XG4gICAgICAgIG11dGF0ZWRBcnJheS5zbGljZShyZW1vdmVJbmRleCwgZGlmZkl0ZW0uaG93TWFueSArIHJlbW92ZUluZGV4KS5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICB2LnR5cGUgPSAncmVtb3ZlJztcbiAgICAgICAgfSk7XG4gICAgICAgIHJlbW92ZWRJdGVtcyArPSBkaWZmSXRlbS5ob3dNYW55O1xuICAgICAgICByZW1vdmVzQnlJbmRleFtkaWZmSXRlbS5pbmRleF0gPSByZW1vdmVkSXRlbXM7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVSZW1vdmVUYWJsZSgpIHtcbiAgICAgICAgcmVtb3ZlZEl0ZW1zID0gMDtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChhY3R1YWwsIGZ1bmN0aW9uIChfLCBpbmRleCkge1xuICAgICAgICAgICAgcmVtb3ZlZEl0ZW1zICs9IHJlbW92ZXNCeUluZGV4W2luZGV4XSB8fCAwO1xuICAgICAgICAgICAgcmVtb3ZlVGFibGVbaW5kZXhdID0gcmVtb3ZlZEl0ZW1zO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB1cGRhdGVSZW1vdmVUYWJsZSgpO1xuXG4gICAgdmFyIG1vdmVzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdtb3ZlJztcbiAgICB9KTtcblxuICAgIHZhciBtb3ZlZEl0ZW1zID0gMDtcbiAgICBtb3Zlcy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgbW92ZUZyb21JbmRleCA9IG9mZnNldEluZGV4KGRpZmZJdGVtLmZyb20pO1xuICAgICAgICB2YXIgcmVtb3ZlZCA9IG11dGF0ZWRBcnJheS5zbGljZShtb3ZlRnJvbUluZGV4LCBkaWZmSXRlbS5ob3dNYW55ICsgbW92ZUZyb21JbmRleCk7XG4gICAgICAgIHZhciBhZGRlZCA9IHJlbW92ZWQubWFwKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kKHt9LCB2LCB7IGxhc3Q6IGZhbHNlLCB0eXBlOiAnaW5zZXJ0JyB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgdi50eXBlID0gJ3JlbW92ZSc7XG4gICAgICAgIH0pO1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KG11dGF0ZWRBcnJheSwgW29mZnNldEluZGV4KGRpZmZJdGVtLnRvKSwgMF0uY29uY2F0KGFkZGVkKSk7XG4gICAgICAgIG1vdmVkSXRlbXMgKz0gZGlmZkl0ZW0uaG93TWFueTtcbiAgICAgICAgcmVtb3Zlc0J5SW5kZXhbZGlmZkl0ZW0uZnJvbV0gPSBtb3ZlZEl0ZW1zO1xuICAgICAgICB1cGRhdGVSZW1vdmVUYWJsZSgpO1xuICAgIH0pO1xuXG4gICAgdmFyIGluc2VydHMgPSBpdGVtc0RpZmYuZmlsdGVyKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICByZXR1cm4gZGlmZkl0ZW0udHlwZSA9PT0gJ2luc2VydCc7XG4gICAgfSk7XG5cbiAgICBpbnNlcnRzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHZhciBhZGRlZCA9IG5ldyBBcnJheShkaWZmSXRlbS52YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZGlmZkl0ZW0udmFsdWVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgYWRkZWRbaV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGRpZmZJdGVtLnZhbHVlc1tpXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KG11dGF0ZWRBcnJheSwgW29mZnNldEluZGV4KGRpZmZJdGVtLmluZGV4KSwgMF0uY29uY2F0KGFkZGVkKSk7XG4gICAgfSk7XG5cbiAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICBtdXRhdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0sIGluZGV4KSB7XG4gICAgICAgIHZhciB0eXBlID0gZGlmZkl0ZW0udHlwZTtcbiAgICAgICAgaWYgKHR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgICAgICBvZmZzZXQgLT0gMTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnc2ltaWxhcicpIHtcbiAgICAgICAgICAgIGRpZmZJdGVtLmV4cGVjdGVkID0gZXhwZWN0ZWRbb2Zmc2V0ICsgaW5kZXhdO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB2YXIgY29uZmxpY3RzID0gbXV0YXRlZEFycmF5LnJlZHVjZShmdW5jdGlvbiAoY29uZmxpY3RzLCBpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLnR5cGUgPT09ICdzaW1pbGFyJyA/IGNvbmZsaWN0cyA6IGNvbmZsaWN0cyArIDE7XG4gICAgfSwgMCk7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgYyA9IDA7IGkgPCBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpICYmICBjIDw9IGNvbmZsaWN0czsgaSArPSAxKSB7XG4gICAgICAgIHZhciBleHBlY3RlZFR5cGUgPSB0eXBlb2YgZXhwZWN0ZWRbaV07XG4gICAgICAgIHZhciBhY3R1YWxUeXBlID0gdHlwZW9mIGFjdHVhbFtpXTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICBhY3R1YWxUeXBlICE9PSBleHBlY3RlZFR5cGUgfHxcbiAgICAgICAgICAgICAgICAoKGFjdHVhbFR5cGUgPT09ICdvYmplY3QnIHx8IGFjdHVhbFR5cGUgPT09ICdzdHJpbmcnKSAmJiAhc2ltaWxhcihhY3R1YWxbaV0sIGV4cGVjdGVkW2ldKSkgfHxcbiAgICAgICAgICAgICAgICAoYWN0dWFsVHlwZSAhPT0gJ29iamVjdCcgJiYgYWN0dWFsVHlwZSAhPT0gJ3N0cmluZycgJiYgIWVxdWFsKGFjdHVhbFtpXSwgZXhwZWN0ZWRbaV0pKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGMgKz0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjIDw9IGNvbmZsaWN0cykge1xuICAgICAgICBtdXRhdGVkQXJyYXkgPSBbXTtcbiAgICAgICAgdmFyIGo7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBNYXRoLm1pbihhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpOyBqICs9IDEpIHtcbiAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc2ltaWxhcicsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGFjdHVhbFtqXSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWRbal1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFjdHVhbC5sZW5ndGggPCBleHBlY3RlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAoOyBqIDwgTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTsgaiArPSAxKSB7XG4gICAgICAgICAgICAgICAgbXV0YXRlZEFycmF5LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGV4cGVjdGVkW2pdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKDsgaiA8IE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxbal1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobXV0YXRlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG11dGF0ZWRBcnJheVttdXRhdGVkQXJyYXkubGVuZ3RoIC0gMV0ubGFzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtdXRhdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgaWYgKGRpZmZJdGVtLnR5cGUgPT09ICdzaW1pbGFyJyAmJiBlcXVhbChkaWZmSXRlbS52YWx1ZSwgZGlmZkl0ZW0uZXhwZWN0ZWQpKSB7XG4gICAgICAgICAgICBkaWZmSXRlbS50eXBlID0gJ2VxdWFsJztcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG11dGF0ZWRBcnJheTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGFycmF5RGlmZjtcblxuLy8gQmFzZWQgb24gc29tZSByb3VnaCBiZW5jaG1hcmtpbmcsIHRoaXMgYWxnb3JpdGhtIGlzIGFib3V0IE8oMm4pIHdvcnN0IGNhc2UsXG4vLyBhbmQgaXQgY2FuIGNvbXB1dGUgZGlmZnMgb24gcmFuZG9tIGFycmF5cyBvZiBsZW5ndGggMTAyNCBpbiBhYm91dCAzNG1zLFxuLy8gdGhvdWdoIGp1c3QgYSBmZXcgY2hhbmdlcyBvbiBhbiBhcnJheSBvZiBsZW5ndGggMTAyNCB0YWtlcyBhYm91dCAwLjVtc1xuXG5hcnJheURpZmYuSW5zZXJ0RGlmZiA9IEluc2VydERpZmY7XG5hcnJheURpZmYuUmVtb3ZlRGlmZiA9IFJlbW92ZURpZmY7XG5hcnJheURpZmYuTW92ZURpZmYgPSBNb3ZlRGlmZjtcblxuZnVuY3Rpb24gSW5zZXJ0RGlmZihpbmRleCwgdmFsdWVzKSB7XG4gIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgdGhpcy52YWx1ZXMgPSB2YWx1ZXM7XG59XG5JbnNlcnREaWZmLnByb3RvdHlwZS50eXBlID0gJ2luc2VydCc7XG5JbnNlcnREaWZmLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiB0aGlzLnR5cGVcbiAgLCBpbmRleDogdGhpcy5pbmRleFxuICAsIHZhbHVlczogdGhpcy52YWx1ZXNcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIFJlbW92ZURpZmYoaW5kZXgsIGhvd01hbnkpIHtcbiAgdGhpcy5pbmRleCA9IGluZGV4O1xuICB0aGlzLmhvd01hbnkgPSBob3dNYW55O1xufVxuUmVtb3ZlRGlmZi5wcm90b3R5cGUudHlwZSA9ICdyZW1vdmUnO1xuUmVtb3ZlRGlmZi5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogdGhpcy50eXBlXG4gICwgaW5kZXg6IHRoaXMuaW5kZXhcbiAgLCBob3dNYW55OiB0aGlzLmhvd01hbnlcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIE1vdmVEaWZmKGZyb20sIHRvLCBob3dNYW55KSB7XG4gIHRoaXMuZnJvbSA9IGZyb207XG4gIHRoaXMudG8gPSB0bztcbiAgdGhpcy5ob3dNYW55ID0gaG93TWFueTtcbn1cbk1vdmVEaWZmLnByb3RvdHlwZS50eXBlID0gJ21vdmUnO1xuTW92ZURpZmYucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IHRoaXMudHlwZVxuICAsIGZyb206IHRoaXMuZnJvbVxuICAsIHRvOiB0aGlzLnRvXG4gICwgaG93TWFueTogdGhpcy5ob3dNYW55XG4gIH07XG59O1xuXG5mdW5jdGlvbiBzdHJpY3RFcXVhbChhLCBiKSB7XG4gIHJldHVybiBhID09PSBiO1xufVxuXG5mdW5jdGlvbiBhcnJheURpZmYoYmVmb3JlLCBhZnRlciwgZXF1YWxGbikge1xuICBpZiAoIWVxdWFsRm4pIGVxdWFsRm4gPSBzdHJpY3RFcXVhbDtcblxuICAvLyBGaW5kIGFsbCBpdGVtcyBpbiBib3RoIHRoZSBiZWZvcmUgYW5kIGFmdGVyIGFycmF5LCBhbmQgcmVwcmVzZW50IHRoZW1cbiAgLy8gYXMgbW92ZXMuIE1hbnkgb2YgdGhlc2UgXCJtb3Zlc1wiIG1heSBlbmQgdXAgYmVpbmcgZGlzY2FyZGVkIGluIHRoZSBsYXN0XG4gIC8vIHBhc3MgaWYgdGhleSBhcmUgZnJvbSBhbiBpbmRleCB0byB0aGUgc2FtZSBpbmRleCwgYnV0IHdlIGRvbid0IGtub3cgdGhpc1xuICAvLyB1cCBmcm9udCwgc2luY2Ugd2UgaGF2ZW4ndCB5ZXQgb2Zmc2V0IHRoZSBpbmRpY2VzLlxuICAvLyBcbiAgLy8gQWxzbyBrZWVwIGEgbWFwIG9mIGFsbCB0aGUgaW5kaWNpZXMgYWNjb3VudGVkIGZvciBpbiB0aGUgYmVmb3JlIGFuZCBhZnRlclxuICAvLyBhcnJheXMuIFRoZXNlIG1hcHMgYXJlIHVzZWQgbmV4dCB0byBjcmVhdGUgaW5zZXJ0IGFuZCByZW1vdmUgZGlmZnMuXG4gIHZhciBiZWZvcmVMZW5ndGggPSBiZWZvcmUubGVuZ3RoO1xuICB2YXIgYWZ0ZXJMZW5ndGggPSBhZnRlci5sZW5ndGg7XG4gIHZhciBtb3ZlcyA9IFtdO1xuICB2YXIgYmVmb3JlTWFya2VkID0ge307XG4gIHZhciBhZnRlck1hcmtlZCA9IHt9O1xuICBmb3IgKHZhciBiZWZvcmVJbmRleCA9IDA7IGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoOyBiZWZvcmVJbmRleCsrKSB7XG4gICAgdmFyIGJlZm9yZUl0ZW0gPSBiZWZvcmVbYmVmb3JlSW5kZXhdO1xuICAgIGZvciAodmFyIGFmdGVySW5kZXggPSAwOyBhZnRlckluZGV4IDwgYWZ0ZXJMZW5ndGg7IGFmdGVySW5kZXgrKykge1xuICAgICAgaWYgKGFmdGVyTWFya2VkW2FmdGVySW5kZXhdKSBjb250aW51ZTtcbiAgICAgIGlmICghZXF1YWxGbihiZWZvcmVJdGVtLCBhZnRlclthZnRlckluZGV4XSkpIGNvbnRpbnVlO1xuICAgICAgdmFyIGZyb20gPSBiZWZvcmVJbmRleDtcbiAgICAgIHZhciB0byA9IGFmdGVySW5kZXg7XG4gICAgICB2YXIgaG93TWFueSA9IDA7XG4gICAgICBkbyB7XG4gICAgICAgIGJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleCsrXSA9IGFmdGVyTWFya2VkW2FmdGVySW5kZXgrK10gPSB0cnVlO1xuICAgICAgICBob3dNYW55Kys7XG4gICAgICB9IHdoaWxlIChcbiAgICAgICAgYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGggJiZcbiAgICAgICAgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoICYmXG4gICAgICAgIGVxdWFsRm4oYmVmb3JlW2JlZm9yZUluZGV4XSwgYWZ0ZXJbYWZ0ZXJJbmRleF0pICYmXG4gICAgICAgICFhZnRlck1hcmtlZFthZnRlckluZGV4XVxuICAgICAgKTtcbiAgICAgIG1vdmVzLnB1c2gobmV3IE1vdmVEaWZmKGZyb20sIHRvLCBob3dNYW55KSk7XG4gICAgICBiZWZvcmVJbmRleC0tO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gQ3JlYXRlIGEgcmVtb3ZlIGZvciBhbGwgb2YgdGhlIGl0ZW1zIGluIHRoZSBiZWZvcmUgYXJyYXkgdGhhdCB3ZXJlXG4gIC8vIG5vdCBtYXJrZWQgYXMgYmVpbmcgbWF0Y2hlZCBpbiB0aGUgYWZ0ZXIgYXJyYXkgYXMgd2VsbFxuICB2YXIgcmVtb3ZlcyA9IFtdO1xuICBmb3IgKGJlZm9yZUluZGV4ID0gMDsgYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGg7KSB7XG4gICAgaWYgKGJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleF0pIHtcbiAgICAgIGJlZm9yZUluZGV4Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdmFyIGluZGV4ID0gYmVmb3JlSW5kZXg7XG4gICAgdmFyIGhvd01hbnkgPSAwO1xuICAgIHdoaWxlIChiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aCAmJiAhYmVmb3JlTWFya2VkW2JlZm9yZUluZGV4KytdKSB7XG4gICAgICBob3dNYW55Kys7XG4gICAgfVxuICAgIHJlbW92ZXMucHVzaChuZXcgUmVtb3ZlRGlmZihpbmRleCwgaG93TWFueSkpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIGFuIGluc2VydCBmb3IgYWxsIG9mIHRoZSBpdGVtcyBpbiB0aGUgYWZ0ZXIgYXJyYXkgdGhhdCB3ZXJlXG4gIC8vIG5vdCBtYXJrZWQgYXMgYmVpbmcgbWF0Y2hlZCBpbiB0aGUgYmVmb3JlIGFycmF5IGFzIHdlbGxcbiAgdmFyIGluc2VydHMgPSBbXTtcbiAgZm9yIChhZnRlckluZGV4ID0gMDsgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoOykge1xuICAgIGlmIChhZnRlck1hcmtlZFthZnRlckluZGV4XSkge1xuICAgICAgYWZ0ZXJJbmRleCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IGFmdGVySW5kZXg7XG4gICAgdmFyIGhvd01hbnkgPSAwO1xuICAgIHdoaWxlIChhZnRlckluZGV4IDwgYWZ0ZXJMZW5ndGggJiYgIWFmdGVyTWFya2VkW2FmdGVySW5kZXgrK10pIHtcbiAgICAgIGhvd01hbnkrKztcbiAgICB9XG4gICAgdmFyIHZhbHVlcyA9IGFmdGVyLnNsaWNlKGluZGV4LCBpbmRleCArIGhvd01hbnkpO1xuICAgIGluc2VydHMucHVzaChuZXcgSW5zZXJ0RGlmZihpbmRleCwgdmFsdWVzKSk7XG4gIH1cblxuICB2YXIgaW5zZXJ0c0xlbmd0aCA9IGluc2VydHMubGVuZ3RoO1xuICB2YXIgcmVtb3Zlc0xlbmd0aCA9IHJlbW92ZXMubGVuZ3RoO1xuICB2YXIgbW92ZXNMZW5ndGggPSBtb3Zlcy5sZW5ndGg7XG4gIHZhciBpLCBqO1xuXG4gIC8vIE9mZnNldCBzdWJzZXF1ZW50IHJlbW92ZXMgYW5kIG1vdmVzIGJ5IHJlbW92ZXNcbiAgdmFyIGNvdW50ID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHJlbW92ZXNMZW5ndGg7IGkrKykge1xuICAgIHZhciByZW1vdmUgPSByZW1vdmVzW2ldO1xuICAgIHJlbW92ZS5pbmRleCAtPSBjb3VudDtcbiAgICBjb3VudCArPSByZW1vdmUuaG93TWFueTtcbiAgICBmb3IgKGogPSAwOyBqIDwgbW92ZXNMZW5ndGg7IGorKykge1xuICAgICAgdmFyIG1vdmUgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChtb3ZlLmZyb20gPj0gcmVtb3ZlLmluZGV4KSBtb3ZlLmZyb20gLT0gcmVtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT2Zmc2V0IG1vdmVzIGJ5IGluc2VydHNcbiAgZm9yIChpID0gaW5zZXJ0c0xlbmd0aDsgaS0tOykge1xuICAgIHZhciBpbnNlcnQgPSBpbnNlcnRzW2ldO1xuICAgIHZhciBob3dNYW55ID0gaW5zZXJ0LnZhbHVlcy5sZW5ndGg7XG4gICAgZm9yIChqID0gbW92ZXNMZW5ndGg7IGotLTspIHtcbiAgICAgIHZhciBtb3ZlID0gbW92ZXNbal07XG4gICAgICBpZiAobW92ZS50byA+PSBpbnNlcnQuaW5kZXgpIG1vdmUudG8gLT0gaG93TWFueTtcbiAgICB9XG4gIH1cblxuICAvLyBPZmZzZXQgdGhlIHRvIG9mIG1vdmVzIGJ5IGxhdGVyIG1vdmVzXG4gIGZvciAoaSA9IG1vdmVzTGVuZ3RoOyBpLS0gPiAxOykge1xuICAgIHZhciBtb3ZlID0gbW92ZXNbaV07XG4gICAgaWYgKG1vdmUudG8gPT09IG1vdmUuZnJvbSkgY29udGludWU7XG4gICAgZm9yIChqID0gaTsgai0tOykge1xuICAgICAgdmFyIGVhcmxpZXIgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChlYXJsaWVyLnRvID49IG1vdmUudG8pIGVhcmxpZXIudG8gLT0gbW92ZS5ob3dNYW55O1xuICAgICAgaWYgKGVhcmxpZXIudG8gPj0gbW92ZS5mcm9tKSBlYXJsaWVyLnRvICs9IG1vdmUuaG93TWFueTtcbiAgICB9XG4gIH1cblxuICAvLyBPbmx5IG91dHB1dCBtb3ZlcyB0aGF0IGVuZCB1cCBoYXZpbmcgYW4gZWZmZWN0IGFmdGVyIG9mZnNldHRpbmdcbiAgdmFyIG91dHB1dE1vdmVzID0gW107XG5cbiAgLy8gT2Zmc2V0IHRoZSBmcm9tIG9mIG1vdmVzIGJ5IGVhcmxpZXIgbW92ZXNcbiAgZm9yIChpID0gMDsgaSA8IG1vdmVzTGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgbW92ZSA9IG1vdmVzW2ldO1xuICAgIGlmIChtb3ZlLnRvID09PSBtb3ZlLmZyb20pIGNvbnRpbnVlO1xuICAgIG91dHB1dE1vdmVzLnB1c2gobW92ZSk7XG4gICAgZm9yIChqID0gaSArIDE7IGogPCBtb3Zlc0xlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgbGF0ZXIgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChsYXRlci5mcm9tID49IG1vdmUuZnJvbSkgbGF0ZXIuZnJvbSAtPSBtb3ZlLmhvd01hbnk7XG4gICAgICBpZiAobGF0ZXIuZnJvbSA+PSBtb3ZlLnRvKSBsYXRlci5mcm9tICs9IG1vdmUuaG93TWFueTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVtb3Zlcy5jb25jYXQob3V0cHV0TW92ZXMsIGluc2VydHMpO1xufVxuIiwiXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG52YXIgc2VsZiA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB7fTtcblxuLyoqXG4gKiBQcmlzbTogTGlnaHR3ZWlnaHQsIHJvYnVzdCwgZWxlZ2FudCBzeW50YXggaGlnaGxpZ2h0aW5nXG4gKiBNSVQgbGljZW5zZSBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocC9cbiAqIEBhdXRob3IgTGVhIFZlcm91IGh0dHA6Ly9sZWEudmVyb3UubWVcbiAqL1xuXG52YXIgUHJpc20gPSAoZnVuY3Rpb24oKXtcblxuLy8gUHJpdmF0ZSBoZWxwZXIgdmFyc1xudmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oPyFcXCopKFxcdyspXFxiL2k7XG5cbnZhciBfID0gc2VsZi5QcmlzbSA9IHtcblx0dXRpbDoge1xuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7IFxuXHRcdFx0cmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5tYXRjaCgvXFxbb2JqZWN0IChcXHcrKVxcXS8pWzFdO1xuXHRcdH0sXG5cdFx0XG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcblxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XG5cdFx0XHRcdFx0dmFyIGNsb25lID0ge307XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIG8pIHtcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmVba2V5XSA9IF8udXRpbC5jbG9uZShvW2tleV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRyZXR1cm4gY2xvbmU7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHRyZXR1cm4gby5zbGljZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gbztcblx0XHR9XG5cdH0sXG5cdFxuXHRsYW5ndWFnZXM6IHtcblx0XHRleHRlbmQ6IGZ1bmN0aW9uIChpZCwgcmVkZWYpIHtcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XG5cdFx0XHRcblx0XHRcdGZvciAodmFyIGtleSBpbiByZWRlZikge1xuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gbGFuZztcblx0XHR9LFxuXHRcdFxuXHRcdC8vIEluc2VydCBhIHRva2VuIGJlZm9yZSBhbm90aGVyIHRva2VuIGluIGEgbGFuZ3VhZ2UgbGl0ZXJhbFxuXHRcdGluc2VydEJlZm9yZTogZnVuY3Rpb24gKGluc2lkZSwgYmVmb3JlLCBpbnNlcnQsIHJvb3QpIHtcblx0XHRcdHJvb3QgPSByb290IHx8IF8ubGFuZ3VhZ2VzO1xuXHRcdFx0dmFyIGdyYW1tYXIgPSByb290W2luc2lkZV07XG5cdFx0XHR2YXIgcmV0ID0ge307XG5cdFx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0XG5cdFx0XHRcdGlmIChncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cmV0W3Rva2VuXSA9IGdyYW1tYXJbdG9rZW5dO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiByb290W2luc2lkZV0gPSByZXQ7XG5cdFx0fSxcblx0XHRcblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrKSB7XG5cdFx0XHRmb3IgKHZhciBpIGluIG8pIHtcblx0XHRcdFx0Y2FsbGJhY2suY2FsbChvLCBpLCBvW2ldKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ09iamVjdCcpIHtcblx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdGhpZ2hsaWdodEFsbDogZnVuY3Rpb24oYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0dmFyIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnY29kZVtjbGFzcyo9XCJsYW5ndWFnZS1cIl0sIFtjbGFzcyo9XCJsYW5ndWFnZS1cIl0gY29kZSwgY29kZVtjbGFzcyo9XCJsYW5nLVwiXSwgW2NsYXNzKj1cImxhbmctXCJdIGNvZGUnKTtcblxuXHRcdGZvciAodmFyIGk9MCwgZWxlbWVudDsgZWxlbWVudCA9IGVsZW1lbnRzW2krK107KSB7XG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGNhbGxiYWNrKTtcblx0XHR9XG5cdH0sXG5cdFx0XG5cdGhpZ2hsaWdodEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdC8vIEZpbmQgbGFuZ3VhZ2Vcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XG5cdFx0XG5cdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XG5cdFx0XHRwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcblx0XHR9XG5cdFx0XG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV07XG5cdFx0XHRncmFtbWFyID0gXy5sYW5ndWFnZXNbbGFuZ3VhZ2VdO1xuXHRcdH1cblxuXHRcdGlmICghZ3JhbW1hcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIGVsZW1lbnQsIGlmIG5vdCBwcmVzZW50XG5cdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5yZXBsYWNlKGxhbmcsICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykgKyAnIGxhbmd1YWdlLScgKyBsYW5ndWFnZTtcblx0XHRcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcblx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cdFx0XG5cdFx0aWYgKC9wcmUvaS50ZXN0KHBhcmVudC5ub2RlTmFtZSkpIHtcblx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlOyBcblx0XHR9XG5cblx0XHR2YXIgY29kZSA9IGVsZW1lbnQudGV4dENvbnRlbnQ7XG5cdFx0XG5cdFx0aWYoIWNvZGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29kZSA9IGNvZGUucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xuXHRcdFxuXHRcdHZhciBlbnYgPSB7XG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxuXHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdFx0Z3JhbW1hcjogZ3JhbW1hcixcblx0XHRcdGNvZGU6IGNvZGVcblx0XHR9O1xuXHRcdFxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcblx0XHRpZiAoYXN5bmMgJiYgc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1x0XG5cdFx0XHRcblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IFRva2VuLnN0cmluZ2lmeShKU09OLnBhcnNlKGV2dC5kYXRhKSwgbGFuZ3VhZ2UpO1xuXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcblxuXHRcdFx0XHRlbnYuZWxlbWVudC5pbm5lckhUTUwgPSBlbnYuaGlnaGxpZ2h0ZWRDb2RlO1xuXHRcdFx0XHRcblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0fTtcblx0XHRcdFxuXHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcblx0XHRcdFx0Y29kZTogZW52LmNvZGVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpXG5cblx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcblxuXHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblx0XHRcdFxuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbGVtZW50KTtcblx0XHRcdFxuXHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0fVxuXHR9LFxuXHRcblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udG9rZW5pemUodGV4dCwgZ3JhbW1hciksIGxhbmd1YWdlKTtcblx0fSxcblx0XG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xuXHRcdHZhciBUb2tlbiA9IF8uVG9rZW47XG5cdFx0XG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcblx0XHRcblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcblx0XHRcblx0XHRpZiAocmVzdCkge1xuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gcmVzdCkge1xuXHRcdFx0XHRncmFtbWFyW3Rva2VuXSA9IHJlc3RbdG9rZW5dO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRkZWxldGUgZ3JhbW1hci5yZXN0O1xuXHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcblx0XHR0b2tlbmxvb3A6IGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblx0XHRcdGlmKCFncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSB8fCAhZ3JhbW1hclt0b2tlbl0pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciBwYXR0ZXJuID0gZ3JhbW1hclt0b2tlbl0sIFxuXHRcdFx0XHRpbnNpZGUgPSBwYXR0ZXJuLmluc2lkZSxcblx0XHRcdFx0bG9va2JlaGluZCA9ICEhcGF0dGVybi5sb29rYmVoaW5kLFxuXHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gMDtcblx0XHRcdFxuXHRcdFx0cGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybiB8fCBwYXR0ZXJuO1xuXHRcdFx0XG5cdFx0XHRmb3IgKHZhciBpPTA7IGk8c3RyYXJyLmxlbmd0aDsgaSsrKSB7IC8vIERvbuKAmXQgY2FjaGUgbGVuZ3RoIGFzIGl0IGNoYW5nZXMgZHVyaW5nIHRoZSBsb29wXG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgc3RyID0gc3RyYXJyW2ldO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdC8vIFNvbWV0aGluZyB3ZW50IHRlcnJpYmx5IHdyb25nLCBBQk9SVCwgQUJPUlQhXG5cdFx0XHRcdFx0YnJlYWsgdG9rZW5sb29wO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoc3RyIGluc3RhbmNlb2YgVG9rZW4pIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSAwO1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIG1hdGNoID0gcGF0dGVybi5leGVjKHN0cik7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0ubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggLSAxICsgbG9va2JlaGluZExlbmd0aCxcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcblx0XHRcdFx0XHQgICAgbGVuID0gbWF0Y2gubGVuZ3RoLFxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBsZW4sXG5cdFx0XHRcdFx0XHRiZWZvcmUgPSBzdHIuc2xpY2UoMCwgZnJvbSArIDEpLFxuXHRcdFx0XHRcdFx0YWZ0ZXIgPSBzdHIuc2xpY2UodG8gKyAxKTsgXG5cblx0XHRcdFx0XHR2YXIgYXJncyA9IFtpLCAxXTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRpZiAoYmVmb3JlKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYmVmb3JlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRhcmdzLnB1c2god3JhcHBlZCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYgKGFmdGVyKSB7XG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHN0cmFyciwgYXJncyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyYXJyO1xuXHR9LFxuXHRcblx0aG9va3M6IHtcblx0XHRhbGw6IHt9LFxuXHRcdFxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgaG9va3MgPSBfLmhvb2tzLmFsbDtcblx0XHRcdFxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcblx0XHRcdFxuXHRcdFx0aG9va3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdFx0fSxcblx0XHRcblx0XHRydW46IGZ1bmN0aW9uIChuYW1lLCBlbnYpIHtcblx0XHRcdHZhciBjYWxsYmFja3MgPSBfLmhvb2tzLmFsbFtuYW1lXTtcblx0XHRcdFxuXHRcdFx0aWYgKCFjYWxsYmFja3MgfHwgIWNhbGxiYWNrcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRmb3IgKHZhciBpPTAsIGNhbGxiYWNrOyBjYWxsYmFjayA9IGNhbGxiYWNrc1tpKytdOykge1xuXHRcdFx0XHRjYWxsYmFjayhlbnYpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufTtcblxudmFyIFRva2VuID0gXy5Ub2tlbiA9IGZ1bmN0aW9uKHR5cGUsIGNvbnRlbnQpIHtcblx0dGhpcy50eXBlID0gdHlwZTtcblx0dGhpcy5jb250ZW50ID0gY29udGVudDtcbn07XG5cblRva2VuLnN0cmluZ2lmeSA9IGZ1bmN0aW9uKG8sIGxhbmd1YWdlLCBwYXJlbnQpIHtcblx0aWYgKHR5cGVvZiBvID09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIG87XG5cdH1cblxuXHRpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pID09ICdbb2JqZWN0IEFycmF5XScpIHtcblx0XHRyZXR1cm4gby5tYXAoZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShlbGVtZW50LCBsYW5ndWFnZSwgbyk7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblx0XG5cdHZhciBlbnYgPSB7XG5cdFx0dHlwZTogby50eXBlLFxuXHRcdGNvbnRlbnQ6IFRva2VuLnN0cmluZ2lmeShvLmNvbnRlbnQsIGxhbmd1YWdlLCBwYXJlbnQpLFxuXHRcdHRhZzogJ3NwYW4nLFxuXHRcdGNsYXNzZXM6IFsndG9rZW4nLCBvLnR5cGVdLFxuXHRcdGF0dHJpYnV0ZXM6IHt9LFxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRwYXJlbnQ6IHBhcmVudFxuXHR9O1xuXHRcblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWydzcGVsbGNoZWNrJ10gPSAndHJ1ZSc7XG5cdH1cblx0XG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcblx0XG5cdHZhciBhdHRyaWJ1dGVzID0gJyc7XG5cdFxuXHRmb3IgKHZhciBuYW1lIGluIGVudi5hdHRyaWJ1dGVzKSB7XG5cdFx0YXR0cmlidXRlcyArPSBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpICsgJ1wiJztcblx0fVxuXHRcblx0cmV0dXJuICc8JyArIGVudi50YWcgKyAnIGNsYXNzPVwiJyArIGVudi5jbGFzc2VzLmpvaW4oJyAnKSArICdcIiAnICsgYXR0cmlidXRlcyArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XG5cdFxufTtcblxuaWYgKCFzZWxmLmRvY3VtZW50KSB7XG5cdGlmICghc2VsZi5hZGRFdmVudExpc3RlbmVyKSB7XG5cdFx0Ly8gaW4gTm9kZS5qc1xuXHRcdHJldHVybiBzZWxmLlByaXNtO1xuXHR9XG4gXHQvLyBJbiB3b3JrZXJcblx0c2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcblx0XHQgICAgbGFuZyA9IG1lc3NhZ2UubGFuZ3VhZ2UsXG5cdFx0ICAgIGNvZGUgPSBtZXNzYWdlLmNvZGU7XG5cdFx0XG5cdFx0c2VsZi5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShfLnRva2VuaXplKGNvZGUsIF8ubGFuZ3VhZ2VzW2xhbmddKSkpO1xuXHRcdHNlbGYuY2xvc2UoKTtcblx0fSwgZmFsc2UpO1xuXHRcblx0cmV0dXJuIHNlbGYuUHJpc207XG59XG5cbi8vIEdldCBjdXJyZW50IHNjcmlwdCBhbmQgaGlnaGxpZ2h0XG52YXIgc2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpO1xuXG5zY3JpcHQgPSBzY3JpcHRbc2NyaXB0Lmxlbmd0aCAtIDFdO1xuXG5pZiAoc2NyaXB0KSB7XG5cdF8uZmlsZW5hbWUgPSBzY3JpcHQuc3JjO1xuXHRcblx0aWYgKGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgXy5oaWdobGlnaHRBbGwpO1xuXHR9XG59XG5cbnJldHVybiBzZWxmLlByaXNtO1xuXG59KSgpO1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0bW9kdWxlLmV4cG9ydHMgPSBQcmlzbTtcbn1cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1tYXJrdXAuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cCA9IHtcblx0J2NvbW1lbnQnOiAvJmx0OyEtLVtcXHdcXFddKj8tLT4vZyxcblx0J3Byb2xvZyc6IC8mbHQ7XFw/Lis/XFw/Pi8sXG5cdCdkb2N0eXBlJzogLyZsdDshRE9DVFlQRS4rPz4vLFxuXHQnY2RhdGEnOiAvJmx0OyFcXFtDREFUQVxcW1tcXHdcXFddKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvJmx0O1xcLz9bXFx3Oi1dK1xccyooPzpcXHMrW1xcdzotXSsoPzo9KD86KFwifCcpKFxcXFw/W1xcd1xcV10pKj9cXDF8W15cXHMnXCI+PV0rKSk/XFxzKikqXFwvPz4vZ2ksXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQndGFnJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvXiZsdDtcXC8/W1xcdzotXSsvaSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogL14mbHQ7XFwvPy8sXG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW1xcdy1dKz86L1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J2F0dHItdmFsdWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC89KD86KCd8XCIpW1xcd1xcV10qPyhcXDEpfFteXFxzPl0rKS9naSxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogLz18PnxcIi9nXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQncHVuY3R1YXRpb24nOiAvXFwvPz4vZyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXFx3Oi1dKy9nLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXFx3LV0rPzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mYW1wOyM/W1xcZGEtel17MSw4fTsvZ2lcbn07XG5cbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XG5QcmlzbS5ob29rcy5hZGQoJ3dyYXAnLCBmdW5jdGlvbihlbnYpIHtcblxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3RpdGxlJ10gPSBlbnYuY29udGVudC5yZXBsYWNlKC8mYW1wOy8sICcmJyk7XG5cdH1cbn0pO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdCdjb21tZW50JzogL1xcL1xcKltcXHdcXFddKj9cXCpcXC8vZyxcblx0J2F0cnVsZSc6IHtcblx0XHRwYXR0ZXJuOiAvQFtcXHctXSs/Lio/KDt8KD89XFxzKnspKS9naSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdwdW5jdHVhdGlvbic6IC9bOzpdL2dcblx0XHR9XG5cdH0sXG5cdCd1cmwnOiAvdXJsXFwoKFtcIiddPykuKj9cXDFcXCkvZ2ksXG5cdCdzZWxlY3Rvcic6IC9bXlxce1xcfVxcc11bXlxce1xcfTtdKig/PVxccypcXHspL2csXG5cdCdwcm9wZXJ0eSc6IC8oXFxifFxcQilbXFx3LV0rKD89XFxzKjopL2lnLFxuXHQnc3RyaW5nJzogLyhcInwnKShcXFxcPy4pKj9cXDEvZyxcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2dpLFxuXHQnaWdub3JlJzogLyYobHR8Z3R8YW1wKTsvZ2ksXG5cdCdwdW5jdHVhdGlvbic6IC9bXFx7XFx9OzpdL2dcbn07XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3N0eWxlJzoge1xuXHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc3R5bGVbXFx3XFxXXSo/KD58Jmd0OylbXFx3XFxXXSo/KCZsdDt8PClcXC9zdHlsZSg+fCZndDspL2lnLFxuXHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdCd0YWcnOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc3R5bGVbXFx3XFxXXSo/KD58Jmd0Oyl8KCZsdDt8PClcXC9zdHlsZSg+fCZndDspL2lnLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5jc3Ncblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufVxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNsaWtlLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jbGlrZSA9IHtcblx0J2NvbW1lbnQnOiB7XG5cdFx0cGF0dGVybjogLyhefFteXFxcXF0pKFxcL1xcKltcXHdcXFddKj9cXCpcXC98KF58W146XSlcXC9cXC8uKj8oXFxyP1xcbnwkKSkvZyxcblx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdH0sXG5cdCdzdHJpbmcnOiAvKFwifCcpKFxcXFw/LikqP1xcMS9nLFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKCg/Oig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbYS16MC05X1xcLlxcXFxdKy9pZyxcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdGluc2lkZToge1xuXHRcdFx0cHVuY3R1YXRpb246IC8oXFwufFxcXFwpL1xuXHRcdH1cblx0fSxcblx0J2tleXdvcmQnOiAvXFxiKGlmfGVsc2V8d2hpbGV8ZG98Zm9yfHJldHVybnxpbnxpbnN0YW5jZW9mfGZ1bmN0aW9ufG5ld3x0cnl8dGhyb3d8Y2F0Y2h8ZmluYWxseXxudWxsfGJyZWFrfGNvbnRpbnVlKVxcYi9nLFxuXHQnYm9vbGVhbic6IC9cXGIodHJ1ZXxmYWxzZSlcXGIvZyxcblx0J2Z1bmN0aW9uJzoge1xuXHRcdHBhdHRlcm46IC9bYS16MC05X10rXFwoL2lnLFxuXHRcdGluc2lkZToge1xuXHRcdFx0cHVuY3R1YXRpb246IC9cXCgvXG5cdFx0fVxuXHR9LFxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfFxcZCpcXC4/XFxkKyhbRWVdLT9cXGQrKT8pXFxiL2csXG5cdCdvcGVyYXRvcic6IC9bLStdezEsMn18IXwmbHQ7PT98Pj0/fD17MSwzfXwoJmFtcDspezEsMn18XFx8P1xcfHxcXD98XFwqfFxcL3xcXH58XFxefFxcJS9nLFxuXHQnaWdub3JlJzogLyYobHR8Z3R8YW1wKTsvZ2ksXG5cdCdwdW5jdHVhdGlvbic6IC9be31bXFxdOygpLC46XS9nXG59O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tamF2YXNjcmlwdC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCA9IFByaXNtLmxhbmd1YWdlcy5leHRlbmQoJ2NsaWtlJywge1xuXHQna2V5d29yZCc6IC9cXGIodmFyfGxldHxpZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxnZXR8c2V0fG5ld3x3aXRofHR5cGVvZnx0cnl8dGhyb3d8Y2F0Y2h8ZmluYWxseXxudWxsfGJyZWFrfGNvbnRpbnVlfHRoaXMpXFxiL2csXG5cdCdudW1iZXInOiAvXFxiLT8oMHhbXFxkQS1GYS1mXSt8XFxkKlxcLj9cXGQrKFtFZV0tP1xcZCspP3xOYU58LT9JbmZpbml0eSlcXGIvZ1xufSk7XG5cblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAna2V5d29yZCcsIHtcblx0J3JlZ2V4Jzoge1xuXHRcdHBhdHRlcm46IC8oXnxbXi9dKVxcLyg/IVxcLykoXFxbLis/XXxcXFxcLnxbXi9cXHJcXG5dKStcXC9bZ2ltXXswLDN9KD89XFxzKigkfFtcXHJcXG4sLjt9KV0pKS9nLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0fVxufSk7XG5cbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ21hcmt1cCcsICd0YWcnLCB7XG5cdFx0J3NjcmlwdCc6IHtcblx0XHRcdHBhdHRlcm46IC8oJmx0O3w8KXNjcmlwdFtcXHdcXFddKj8oPnwmZ3Q7KVtcXHdcXFddKj8oJmx0O3w8KVxcL3NjcmlwdCg+fCZndDspL2lnLFxuXHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdCd0YWcnOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc2NyaXB0W1xcd1xcV10qPyg+fCZndDspfCgmbHQ7fDwpXFwvc2NyaXB0KD58Jmd0OykvaWcsXG5cdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZy5pbnNpZGVcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVzdDogUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHRcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tZmlsZS1oaWdobGlnaHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuKGZ1bmN0aW9uKCl7XG5cbmlmICghc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xuXHRyZXR1cm47XG59XG5cbnZhciBFeHRlbnNpb25zID0ge1xuXHQnanMnOiAnamF2YXNjcmlwdCcsXG5cdCdodG1sJzogJ21hcmt1cCcsXG5cdCdzdmcnOiAnbWFya3VwJ1xufTtcblxuQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgncHJlW2RhdGEtc3JjXScpKS5mb3JFYWNoKGZ1bmN0aW9uKHByZSkge1xuXHR2YXIgc3JjID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcblx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCcnXSlbMV07XG5cdHZhciBsYW5ndWFnZSA9IEV4dGVuc2lvbnNbZXh0ZW5zaW9uXSB8fCBleHRlbnNpb247XG5cdFxuXHR2YXIgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKTtcblx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXHRcblx0cHJlLnRleHRDb250ZW50ID0gJyc7XG5cdFxuXHRjb2RlLnRleHRDb250ZW50ID0gJ0xvYWRpbmfigKYnO1xuXHRcblx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xuXHRcblx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcblx0eGhyLm9wZW4oJ0dFVCcsIHNyYywgdHJ1ZSk7XG5cblx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh4aHIucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcblx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9IHhoci5yZXNwb25zZVRleHQ7XG5cdFx0XHRcblx0XHRcdFx0UHJpc20uaGlnaGxpZ2h0RWxlbWVudChjb2RlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKHhoci5zdGF0dXMgPj0gNDAwKSB7XG5cdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblx0XG5cdHhoci5zZW5kKG51bGwpO1xufSk7XG5cbn0pKCk7IiwidmFyIHByaXNtID0gcmVxdWlyZSgnLi4vM3JkcGFydHkvcHJpc20nKSxcbiAgICBkZWZhdWx0VGhlbWUgPSB7XG4gICAgICAgIC8vIEFkYXB0ZWQgZnJvbSB0aGUgZGVmYXVsdCBQcmlzbSB0aGVtZTpcbiAgICAgICAgcHJpc21Db21tZW50OiAnIzcwODA5MCcsIC8vIHNsYXRlZ3JheVxuICAgICAgICBwcmlzbVByb2xvZzogJ3ByaXNtQ29tbWVudCcsXG4gICAgICAgIHByaXNtRG9jdHlwZTogJ3ByaXNtQ29tbWVudCcsXG4gICAgICAgIHByaXNtQ2RhdGE6ICdwcmlzbUNvbW1lbnQnLFxuXG4gICAgICAgIHByaXNtUHVuY3R1YXRpb246ICcjOTk5JyxcblxuICAgICAgICBwcmlzbVN5bWJvbDogJyM5MDUnLFxuICAgICAgICBwcmlzbVByb3BlcnR5OiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbVRhZzogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21Cb29sZWFuOiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbU51bWJlcjogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21Db25zdGFudDogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21EZWxldGVkOiAncHJpc21TeW1ib2wnLFxuXG4gICAgICAgIHByaXNtU3RyaW5nOiAnIzY5MCcsXG4gICAgICAgIHByaXNtU2VsZWN0b3I6ICdwcmlzbVN0cmluZycsXG4gICAgICAgIHByaXNtQXR0ck5hbWU6ICdwcmlzbVN0cmluZycsXG4gICAgICAgIHByaXNtQ2hhcjogJ3ByaXNtU3RyaW5nJyxcbiAgICAgICAgcHJpc21CdWlsdGluOiAncHJpc21TdHJpbmcnLFxuICAgICAgICBwcmlzbUluc2VydGVkOiAncHJpc21TdHJpbmcnLFxuXG4gICAgICAgIHByaXNtT3BlcmF0b3I6ICcjYTY3ZjU5JyxcbiAgICAgICAgcHJpc21WYXJpYWJsZTogJ3ByaXNtT3BlcmF0b3InLFxuICAgICAgICBwcmlzbUVudGl0eTogJ3ByaXNtT3BlcmF0b3InLFxuICAgICAgICBwcmlzbVVybDogJ3ByaXNtT3BlcmF0b3InLFxuICAgICAgICBwcmlzbUNzc1N0cmluZzogJ3ByaXNtT3BlcmF0b3InLFxuXG4gICAgICAgIHByaXNtS2V5d29yZDogJyMwN2EnLFxuICAgICAgICBwcmlzbUF0cnVsZTogJ3ByaXNtS2V5d29yZCcsXG4gICAgICAgIHByaXNtQXR0clZhbHVlOiAncHJpc21LZXl3b3JkJyxcblxuICAgICAgICBwcmlzbUZ1bmN0aW9uOiAnI0RENEE2OCcsXG5cbiAgICAgICAgcHJpc21SZWdleDogJyNlOTAnLFxuICAgICAgICBwcmlzbUltcG9ydGFudDogWycjZTkwJywgJ2JvbGQnXVxuICAgIH0sXG4gICAgbGFuZ3VhZ2VNYXBwaW5nID0ge1xuICAgICAgICAndGV4dC9odG1sJzogJ21hcmt1cCcsXG4gICAgICAgICdhcHBsaWNhdGlvbi94bWwnOiAnbWFya3VwJyxcbiAgICAgICAgJ3RleHQveG1sJzogJ21hcmt1cCcsXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ2phdmFzY3JpcHQnLFxuICAgICAgICAndGV4dC9qYXZhc2NyaXB0JzogJ2phdmFzY3JpcHQnLFxuICAgICAgICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCc6ICdqYXZhc2NyaXB0JyxcbiAgICAgICAgJ3RleHQvY3NzJzogJ2NzcycsXG4gICAgICAgIGh0bWw6ICdtYXJrdXAnLFxuICAgICAgICB4bWw6ICdtYXJrdXAnLFxuICAgICAgICBjOiAnY2xpa2UnLFxuICAgICAgICAnYysrJzogJ2NsaWtlJyxcbiAgICAgICAgJ2NwcCc6ICdjbGlrZScsXG4gICAgICAgICdjIyc6ICdjbGlrZScsXG4gICAgICAgIGphdmE6ICdjbGlrZSdcbiAgICB9O1xuXG5mdW5jdGlvbiB1cHBlckNhbWVsQ2FzZShzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyg/Ol58LSkoW2Etel0pL2csIGZ1bmN0aW9uICgkMCwgY2gpIHtcbiAgICAgICAgcmV0dXJuIGNoLnRvVXBwZXJDYXNlKCk7XG4gICAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIG5hbWU6ICdtYWdpY3Blbi1wcmlzbScsXG4gICAgaW5zdGFsbEludG86IGZ1bmN0aW9uIChtYWdpY1Blbikge1xuICAgICAgICBtYWdpY1Blbi5pbnN0YWxsVGhlbWUoZGVmYXVsdFRoZW1lKTtcblxuICAgICAgICBtYWdpY1Blbi5hZGRTdHlsZSgnY29kZScsIGZ1bmN0aW9uIChzb3VyY2VUZXh0LCBsYW5ndWFnZSkge1xuICAgICAgICAgICAgaWYgKGxhbmd1YWdlIGluIGxhbmd1YWdlTWFwcGluZykge1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlID0gbGFuZ3VhZ2VNYXBwaW5nW2xhbmd1YWdlXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoL1xcK3htbFxcYi8udGVzdChsYW5ndWFnZSkpIHtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZSA9ICdtYXJrdXAnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEobGFuZ3VhZ2UgaW4gcHJpc20ubGFuZ3VhZ2VzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRleHQoc291cmNlVGV4dCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNvdXJjZVRleHQgPSBzb3VyY2VUZXh0LnJlcGxhY2UoLzwvZywgJyZsdDsnKTsgLy8gUHJpc21pc21cblxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgICAgIGNhcGl0YWxpemVkTGFuZ3VhZ2UgPSB1cHBlckNhbWVsQ2FzZShsYW5ndWFnZSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHByaW50VG9rZW5zKHRva2VuLCBwYXJlbnRTdHlsZSkge1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRva2VuKSkge1xuICAgICAgICAgICAgICAgICAgICB0b2tlbi5mb3JFYWNoKGZ1bmN0aW9uIChzdWJUb2tlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRUb2tlbnMoc3ViVG9rZW4sIHBhcmVudFN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZSA9IHVwcGVyQ2FtZWxDYXNlKHBhcmVudFN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4gPSB0b2tlbi5yZXBsYWNlKC8mbHQ7L2csICc8Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGF0WydwcmlzbScgKyBjYXBpdGFsaXplZExhbmd1YWdlICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0WydwcmlzbScgKyBjYXBpdGFsaXplZExhbmd1YWdlICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKHRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGF0WydwcmlzbScgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXRbJ3ByaXNtJyArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSh0b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRleHQodG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRUb2tlbnModG9rZW4uY29udGVudCwgdG9rZW4udHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJpbnRUb2tlbnMocHJpc20udG9rZW5pemUoc291cmNlVGV4dCwgcHJpc20ubGFuZ3VhZ2VzW2xhbmd1YWdlXSksICd0ZXh0Jyk7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH1cbn07XG4iXX0=
