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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvbWF0Y2hlc1NlbGVjdG9yLmpzIiwibm9kZV9tb2R1bGVzL2FycmF5LWNoYW5nZXMvbGliL2FycmF5Q2hhbmdlcy5qcyIsIm5vZGVfbW9kdWxlcy9hcnJheS1jaGFuZ2VzL25vZGVfbW9kdWxlcy9hcnJheWRpZmYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWFnaWNwZW4tcHJpc20vM3JkcGFydHkvcHJpc20uanMiLCJub2RlX21vZHVsZXMvbWFnaWNwZW4tcHJpc20vbGliL21hZ2ljUGVuUHJpc20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGFycmF5Q2hhbmdlcyA9IHJlcXVpcmUoJ2FycmF5LWNoYW5nZXMnKTtcbnZhciBtYXRjaGVzU2VsZWN0b3IgPSByZXF1aXJlKCcuL21hdGNoZXNTZWxlY3RvcicpO1xuXG5mdW5jdGlvbiBwYXJzZUh0bWwoc3RyLCBpc0ZyYWdtZW50LCBhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlKSB7XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgc3RyID0gJzxodG1sPjxoZWFkPjwvaGVhZD48Ym9keT4nICsgc3RyICsgJzwvYm9keT48L2h0bWw+JztcbiAgfVxuICB2YXIgaHRtbERvY3VtZW50O1xuICBpZiAodHlwZW9mIERPTVBhcnNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBodG1sRG9jdW1lbnQgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHN0ciwgJ3RleHQvaHRtbCcpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24gJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KSB7XG4gICAgaHRtbERvY3VtZW50ID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KCcnKTtcbiAgICBodG1sRG9jdW1lbnQub3BlbigpO1xuICAgIGh0bWxEb2N1bWVudC53cml0ZShzdHIpO1xuICAgIGh0bWxEb2N1bWVudC5jbG9zZSgpO1xuICB9IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICBodG1sRG9jdW1lbnQgPSByZXF1aXJlKCdqc2RvbScpLmpzZG9tKHN0cik7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQtZG9tJyArIChhc3NlcnRpb25OYW1lRm9yRXJyb3JNZXNzYWdlID8gJyAoJyArIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UgKyAnKScgOiAnJykgKyAnOiBSdW5uaW5nIG91dHNpZGUgYSBicm93c2VyLCBidXQgY291bGQgbm90IGZpbmQgdGhlIGBqc2RvbWAgbW9kdWxlLiBQbGVhc2UgbnBtIGluc3RhbGwganNkb20gdG8gbWFrZSB0aGlzIHdvcmsuJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc0ZyYWdtZW50KSB7XG4gICAgdmFyIGJvZHkgPSBodG1sRG9jdW1lbnQuYm9keTtcbiAgICB2YXIgZG9jdW1lbnRGcmFnbWVudCA9IGh0bWxEb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgaWYgKGJvZHkpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGJvZHkuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgZG9jdW1lbnRGcmFnbWVudC5hcHBlbmRDaGlsZChib2R5LmNoaWxkTm9kZXNbaV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRvY3VtZW50RnJhZ21lbnQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGh0bWxEb2N1bWVudDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZVhtbChzdHIsIGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UpIHtcbiAgaWYgKHR5cGVvZiBET01QYXJzZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoc3RyLCAndGV4dC94bWwnKTtcbiAgfSBlbHNlIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHJlcXVpcmUoJ2pzZG9tJykuanNkb20oc3RyLCB7IHBhcnNpbmdNb2RlOiAneG1sJyB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZC1kb20nICsgKGFzc2VydGlvbk5hbWVGb3JFcnJvck1lc3NhZ2UgPyAnICgnICsgYXNzZXJ0aW9uTmFtZUZvckVycm9yTWVzc2FnZSArICcpJyA6ICcnKSArICc6IFJ1bm5pbmcgb3V0c2lkZSBhIGJyb3dzZXIgKG9yIGluIGEgYnJvd3NlciB3aXRob3V0IERPTVBhcnNlciksIGJ1dCBjb3VsZCBub3QgZmluZCB0aGUgYGpzZG9tYCBtb2R1bGUuIFBsZWFzZSBucG0gaW5zdGFsbCBqc2RvbSB0byBtYWtlIHRoaXMgd29yay4nKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRnJvbSBodG1sLW1pbmlmaWVyXG52YXIgZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlcyA9IHtcbiAgZHJhZ2dhYmxlOiBbJ3RydWUnLCAnZmFsc2UnXSAvLyBkZWZhdWx0cyB0byAnYXV0bydcbn07XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKSB7XG4gIHZhciBpc1NpbXBsZUJvb2xlYW4gPSAoL14oPzphbGxvd2Z1bGxzY3JlZW58YXN5bmN8YXV0b2ZvY3VzfGF1dG9wbGF5fGNoZWNrZWR8Y29tcGFjdHxjb250cm9sc3xkZWNsYXJlfGRlZmF1bHR8ZGVmYXVsdGNoZWNrZWR8ZGVmYXVsdG11dGVkfGRlZmF1bHRzZWxlY3RlZHxkZWZlcnxkaXNhYmxlZHxlbmFibGVkfGZvcm1ub3ZhbGlkYXRlfGhpZGRlbnxpbmRldGVybWluYXRlfGluZXJ0fGlzbWFwfGl0ZW1zY29wZXxsb29wfG11bHRpcGxlfG11dGVkfG5vaHJlZnxub3Jlc2l6ZXxub3NoYWRlfG5vdmFsaWRhdGV8bm93cmFwfG9wZW58cGF1c2VvbmV4aXR8cmVhZG9ubHl8cmVxdWlyZWR8cmV2ZXJzZWR8c2NvcGVkfHNlYW1sZXNzfHNlbGVjdGVkfHNvcnRhYmxlfHNwZWxsY2hlY2t8dHJ1ZXNwZWVkfHR5cGVtdXN0bWF0Y2h8dmlzaWJsZSkkL2kpLnRlc3QoYXR0ck5hbWUpO1xuICBpZiAoaXNTaW1wbGVCb29sZWFuKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgYXR0clZhbHVlRW51bWVyYXRpb24gPSBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzW2F0dHJOYW1lLnRvTG93ZXJDYXNlKCldO1xuICBpZiAoIWF0dHJWYWx1ZUVudW1lcmF0aW9uKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGVsc2Uge1xuICAgIHJldHVybiAoLTEgPT09IGF0dHJWYWx1ZUVudW1lcmF0aW9uLmluZGV4T2YoYXR0clZhbHVlLnRvTG93ZXJDYXNlKCkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHlsZVN0cmluZ1RvT2JqZWN0KHN0cikge1xuICB2YXIgc3R5bGVzID0ge307XG5cbiAgc3RyLnNwbGl0KCc7JykuZm9yRWFjaChmdW5jdGlvbiAocnVsZSkge1xuICAgIHZhciB0dXBsZSA9IHJ1bGUuc3BsaXQoJzonKS5tYXAoZnVuY3Rpb24gKHBhcnQpIHsgcmV0dXJuIHBhcnQudHJpbSgpOyB9KTtcblxuICAgIC8vIEd1YXJkIGFnYWluc3QgZW1wdHkgdG91cGxlc1xuICAgIGlmICh0dXBsZVswXSAmJiB0dXBsZVsxXSkge1xuICAgICAgc3R5bGVzW3R1cGxlWzBdXSA9IHR1cGxlWzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSkge1xuICBpZiAoYXR0cmlidXRlVmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICB2YXIgY2xhc3NOYW1lcyA9IGF0dHJpYnV0ZVZhbHVlLnNwbGl0KC9cXHMrLyk7XG4gIGlmIChjbGFzc05hbWVzLmxlbmd0aCA9PT0gMSAmJiBjbGFzc05hbWVzWzBdID09PSAnJykge1xuICAgIGNsYXNzTmFtZXMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIGNsYXNzTmFtZXM7XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZXMoZWxlbWVudCkge1xuICB2YXIgaXNIdG1sID0gZWxlbWVudC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgdmFyIGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChhdHRyc1tpXS5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBhdHRyc1tpXS52YWx1ZSAmJiBhdHRyc1tpXS52YWx1ZS5zcGxpdCgnICcpIHx8IFtdO1xuICAgIH0gZWxzZSBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gc3R5bGVTdHJpbmdUb09iamVjdChhdHRyc1tpXS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cnNbaV0ubmFtZSkgPyB0cnVlIDogKGF0dHJzW2ldLnZhbHVlIHx8ICcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBlbnRpdGlmeSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpIHtcbiAgcmV0dXJuICgvKD86YXJlYXxiYXNlfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKS9pKS50ZXN0KGVsZW1lbnROYW1lKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgdmFsdWUsIGlzSHRtbCkge1xuICBvdXRwdXQucHJpc21BdHRyTmFtZShhdHRyaWJ1dGVOYW1lKTtcbiAgaWYgKCFpc0h0bWwgfHwgIWlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSkge1xuICAgIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLmpvaW4oJyAnKTtcbiAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgIHZhbHVlID0gT2JqZWN0LmtleXModmFsdWUpLm1hcChmdW5jdGlvbiAoY3NzUHJvcCkge1xuICAgICAgICByZXR1cm4gY3NzUHJvcCArICc6ICcgKyB2YWx1ZVtjc3NQcm9wXTtcbiAgICAgIH0pLmpvaW4oJzsgJyk7XG4gICAgfVxuICAgIG91dHB1dFxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJz1cIicpXG4gICAgICAucHJpc21BdHRyVmFsdWUoZW50aXRpZnkodmFsdWUpKVxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJ1wiJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZTtcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgcmV0dXJuICdjbGFzcz1cIicgKyB2YWx1ZS5qb2luKCcgJykgKyAnXCInOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgcmV0dXJuICdzdHlsZT1cIicgKyBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKGZ1bmN0aW9uIChjc3NQcm9wKSB7XG4gICAgICByZXR1cm4gW2Nzc1Byb3AsIHZhbHVlW2Nzc1Byb3BdXS5qb2luKCc6ICcpOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgICB9KS5qb2luKCc7ICcpICsgJ1wiJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZSArICc9XCInICsgZW50aXRpZnkodmFsdWUpICsgJ1wiJztcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCcgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICB2YXIgc3RyID0gJzwnICsgZWxlbWVudE5hbWU7XG4gIHZhciBhdHRycyA9IGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCk7XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHN0ciArPSAnICcgKyBzdHJpbmdpZnlBdHRyaWJ1dGUoa2V5LCBhdHRyc1trZXldKTtcbiAgfSk7XG5cbiAgc3RyICs9ICc+JztcbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gIHZhciBlbGVtZW50TmFtZSA9IGlzSHRtbCA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG4gIGlmIChpc0h0bWwgJiYgaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkgJiYgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJzwvJyArIGVsZW1lbnROYW1lICsgJz4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRpZmZOb2RlTGlzdHMoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICB2YXIgY2hhbmdlcyA9IGFycmF5Q2hhbmdlcyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhY3R1YWwpLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChleHBlY3RlZCksIGVxdWFsLCBmdW5jdGlvbiAoYSwgYikge1xuICAgIC8vIEZpZ3VyZSBvdXQgd2hldGhlciBhIGFuZCBiIGFyZSBcInN0cnV0dXJhbGx5IHNpbWlsYXJcIiBzbyB0aGV5IGNhbiBiZSBkaWZmZWQgaW5saW5lLlxuICAgIHJldHVybiAoXG4gICAgICBhLm5vZGVUeXBlID09PSAxICYmIGIubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgIGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWVcbiAgICApO1xuICB9KTtcblxuICBjaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtLCBpbmRleCkge1xuICAgIG91dHB1dC5pKCkuYmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHR5cGUgPSBkaWZmSXRlbS50eXBlO1xuICAgICAgaWYgKHR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgIHRoaXMuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdtaXNzaW5nICcpLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkuc3AoKS5lcnJvcignLy8gc2hvdWxkIGJlIHJlbW92ZWQnKSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdlcXVhbCcpIHtcbiAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgdmFsdWVEaWZmID0gZGlmZihkaWZmSXRlbS52YWx1ZSwgZGlmZkl0ZW0uZXhwZWN0ZWQpO1xuICAgICAgICBpZiAodmFsdWVEaWZmICYmIHZhbHVlRGlmZi5pbmxpbmUpIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKHZhbHVlRGlmZi5kaWZmKTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZURpZmYpIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNob3VsZEVxdWFsRXJyb3IoZGlmZkl0ZW0uZXhwZWN0ZWQsIGluc3BlY3QpLm5sKCkuYXBwZW5kKHZhbHVlRGlmZi5kaWZmKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNob3VsZEVxdWFsRXJyb3IoZGlmZkl0ZW0uZXhwZWN0ZWQsIGluc3BlY3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkubmwoaW5kZXggPCBjaGFuZ2VzLmxlbmd0aCAtIDEgPyAxIDogMCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbmFtZTogJ3VuZXhwZWN0ZWQtZG9tJyxcbiAgaW5zdGFsbEludG86IGZ1bmN0aW9uIChleHBlY3QpIHtcbiAgICBleHBlY3QuaW5zdGFsbFBsdWdpbihyZXF1aXJlKCdtYWdpY3Blbi1wcmlzbScpKTtcbiAgICB2YXIgdG9wTGV2ZWxFeHBlY3QgPSBleHBlY3Q7XG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGUnLFxuICAgICAgYmFzZTogJ29iamVjdCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlTmFtZSAmJiBbMiwgMywgNCwgNSwgNiwgNywgMTAsIDExLCAxMl0uaW5kZXhPZihvYmoubm9kZVR5cGUpID4gLTE7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVsZW1lbnQubm9kZU5hbWUgKyAnIFwiJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJ1wiJywgJ3ByaXNtLXN0cmluZycpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUNvbW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDg7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKCc8IS0tJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJy0tPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IS0tJyArIGFjdHVhbC5ub2RlVmFsdWUgKyAnLS0+JywgJzwhLS0nICsgZXhwZWN0ZWQubm9kZVZhbHVlICsgJy0tPicpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTVRleHROb2RlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUgPT09IGIubm9kZVZhbHVlO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChlbGVtZW50LCBkZXB0aCwgb3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZShlbnRpdGlmeShlbGVtZW50Lm5vZGVWYWx1ZS50cmltKCkpLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihhY3R1YWwubm9kZVZhbHVlLCBleHBlY3RlZC5ub2RlVmFsdWUpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdhcnJheS1saWtlJyxcbiAgICAgIHByZWZpeDogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ05vZGVMaXN0WycpO1xuICAgICAgfSxcbiAgICAgIHN1ZmZpeDogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ10nKTtcbiAgICAgIH0sXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iaiAmJlxuICAgICAgICAgIHR5cGVvZiBvYmoubGVuZ3RoID09PSAnbnVtYmVyJyAmJlxuICAgICAgICAgIHR5cGVvZiBvYmoudG9TdHJpbmcgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLml0ZW0gPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICBvYmoudG9TdHJpbmcoKS5pbmRleE9mKCdOb2RlTGlzdCcpICE9PSAtMVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gRmFrZSB0eXBlIHRvIG1ha2UgaXQgcG9zc2libGUgdG8gYnVpbGQgJ3RvIHNhdGlzZnknIGRpZmZzIHRvIGJlIHJlbmRlcmVkIGlubGluZTpcbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnYXR0YWNoZWRET01Ob2RlTGlzdCcsXG4gICAgICBiYXNlOiAnYXJyYXktbGlrZScsXG4gICAgICBwcmVmaXg6IGZ1bmN0aW9uIChvdXRwdXQpIHsgcmV0dXJuIG91dHB1dDsgfSxcbiAgICAgIHN1ZmZpeDogZnVuY3Rpb24gKG91dHB1dCkgeyByZXR1cm4gb3V0cHV0OyB9LFxuICAgICAgZGVsaW1pdGVyOiBmdW5jdGlvbiAob3V0cHV0KSB7IHJldHVybiBvdXRwdXQ7IH0sXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5faXNBdHRhY2hlZERPTU5vZGVMaXN0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2NUeXBlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAxMCAmJiAncHVibGljSWQnIGluIG9iajtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdHlwZSwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICBvdXRwdXQuY29kZSgnPCFET0NUWVBFICcgKyBkb2N0eXBlLm5hbWUgKyAnPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLnRvU3RyaW5nKCkgPT09IGIudG9TdHJpbmcoKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmKSB7XG4gICAgICAgIHZhciBkID0gZGlmZignPCFET0NUWVBFICcgKyBhY3R1YWwubmFtZSArICc+JywgJzwhRE9DVFlQRSAnICsgZXhwZWN0ZWQubmFtZSArICc+Jyk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDkgJiYgb2JqLmRvY3VtZW50RWxlbWVudCAmJiBvYmouaW1wbGVtZW50YXRpb247XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0KGRvY3VtZW50LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgIGRpZmY6IG91dHB1dFxuICAgICAgICB9O1xuICAgICAgICBkaWZmTm9kZUxpc3RzKGFjdHVhbC5jaGlsZE5vZGVzLCBleHBlY3RlZC5jaGlsZE5vZGVzLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTURvY3VtZW50JyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJhc2VUeXBlLmlkZW50aWZ5KG9iaikgJiYgb2JqLmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdYTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmFzZVR5cGUuaWRlbnRpZnkob2JqKSAmJiAvXig/OmFwcGxpY2F0aW9ufHRleHQpXFwveG1sfFxcK3htbFxcYi8udGVzdChvYmouY29udGVudFR5cGUpO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChkb2N1bWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICBvdXRwdXQuY29kZSgnPD94bWwgdmVyc2lvbj1cIjEuMFwiPz4nLCAneG1sJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0KGRvY3VtZW50LmNoaWxkTm9kZXNbaV0sIGRlcHRoIC0gMSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRG9jdW1lbnRGcmFnbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMTE7IC8vIEluIGpzZG9tLCBkb2N1bWVudEZyYWdtZW50LnRvU3RyaW5nKCkgZG9lcyBub3QgcmV0dXJuIFtvYmplY3QgRG9jdW1lbnRGcmFnbWVudF1cbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdW1lbnRGcmFnbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICBvdXRwdXQudGV4dCgnRG9jdW1lbnRGcmFnbWVudFsnKS5hcHBlbmQoaW5zcGVjdChkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXMsIGRlcHRoKSkudGV4dCgnXScpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgIGRpZmY6IG91dHB1dFxuICAgICAgICB9O1xuICAgICAgICBkaWZmTm9kZUxpc3RzKGFjdHVhbC5jaGlsZE5vZGVzLCBleHBlY3RlZC5jaGlsZE5vZGVzLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01FbGVtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAxICYmIG9iai5ub2RlTmFtZSAmJiBvYmouYXR0cmlidXRlcztcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIsIGVxdWFsKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGIubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAmJiBlcXVhbChnZXRBdHRyaWJ1dGVzKGEpLCBnZXRBdHRyaWJ1dGVzKGIpKSAmJiBlcXVhbChhLmNoaWxkTm9kZXMsIGIuY2hpbGROb2Rlcyk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgdmFyIGVsZW1lbnROYW1lID0gZWxlbWVudC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgc3RhcnRUYWcgPSBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KTtcblxuICAgICAgICBvdXRwdXQuY29kZShzdGFydFRhZywgJ2h0bWwnKTtcbiAgICAgICAgaWYgKGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICBpZiAoZGVwdGggPT09IDEpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LnRleHQoJy4uLicpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgaW5zcGVjdGVkQ2hpbGRyZW4gPSBbXTtcbiAgICAgICAgICAgIGlmIChlbGVtZW50TmFtZSA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgICAgICAgICAgdmFyIHR5cGUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpO1xuICAgICAgICAgICAgICBpZiAoIXR5cGUgfHwgL2phdmFzY3JpcHQvLnRlc3QodHlwZSkpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ2phdmFzY3JpcHQnO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCB0eXBlKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnROYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpIHx8ICd0ZXh0L2NzcycpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKGluc3BlY3QoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdpZHRoID0gMDtcbiAgICAgICAgICAgIHZhciBtdWx0aXBsZUxpbmVzID0gaW5zcGVjdGVkQ2hpbGRyZW4uc29tZShmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgICB2YXIgc2l6ZSA9IG8uc2l6ZSgpO1xuICAgICAgICAgICAgICB3aWR0aCArPSBzaXplLndpZHRoO1xuICAgICAgICAgICAgICByZXR1cm4gd2lkdGggPiA1MCB8fCBvLmhlaWdodCA+IDE7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKG11bHRpcGxlTGluZXMpIHtcbiAgICAgICAgICAgICAgb3V0cHV0Lm5sKCkuaW5kZW50TGluZXMoKTtcblxuICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQuaSgpLmJsb2NrKGluc3BlY3RlZENoaWxkKS5ubCgpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICBvdXRwdXQub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3RlZENoaWxkKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhlbGVtZW50KSwgJ2h0bWwnKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG4gICAgICBkaWZmTGltaXQ6IDUxMixcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBpc0h0bWwgPSBhY3R1YWwub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgZGlmZjogb3V0cHV0LFxuICAgICAgICAgIGlubGluZTogdHJ1ZVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpID4gdGhpcy5kaWZmTGltaXQpIHtcbiAgICAgICAgICByZXN1bHQuZGlmZi5qc0NvbW1lbnQoJ0RpZmYgc3VwcHJlc3NlZCBkdWUgdG8gc2l6ZSA+ICcgKyB0aGlzLmRpZmZMaW1pdCk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbXB0eUVsZW1lbnRzID0gYWN0dWFsLmNoaWxkTm9kZXMubGVuZ3RoID09PSAwICYmIGV4cGVjdGVkLmNoaWxkTm9kZXMubGVuZ3RoID09PSAwO1xuICAgICAgICB2YXIgY29uZmxpY3RpbmdFbGVtZW50ID0gYWN0dWFsLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgIT09IGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgfHwgIWVxdWFsKGdldEF0dHJpYnV0ZXMoYWN0dWFsKSwgZ2V0QXR0cmlidXRlcyhleHBlY3RlZCkpO1xuXG4gICAgICAgIGlmIChjb25mbGljdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgICB2YXIgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc8JylcbiAgICAgICAgICAgIC5wcmlzbVRhZyhhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgaWYgKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgYmUnKS5zcCgpLnByaXNtVGFnKGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgYWN0dWFsQXR0cmlidXRlcyA9IGdldEF0dHJpYnV0ZXMoYWN0dWFsKTtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gZ2V0QXR0cmlidXRlcyhleHBlY3RlZCk7XG4gICAgICAgICAgT2JqZWN0LmtleXMoYWN0dWFsQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgYWN0dWFsLm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4ob3V0cHV0LCBhdHRyaWJ1dGVOYW1lLCBhY3R1YWxBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZU5hbWUgaW4gZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgIGlmIChhY3R1YWxBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID09PSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0pIHtcbiAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgZXF1YWwnKS5zcCgpLmFwcGVuZChpbnNwZWN0KGVudGl0aWZ5KGV4cGVjdGVkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkpKTtcbiAgICAgICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ3Nob3VsZCBiZSByZW1vdmVkJyk7XG4gICAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkQXR0cmlidXRlcykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKGNhbkNvbnRpbnVlTGluZSA/IDEgOiAyICsgYWN0dWFsLm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICBvdXRwdXQuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgdGhpcy5lcnJvcignbWlzc2luZycpLnNwKCk7XG4gICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1Blbih0aGlzLCBhdHRyaWJ1dGVOYW1lLCBleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0sIGlzSHRtbCk7XG4gICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgb3V0cHV0LnByaXNtUHVuY3R1YXRpb24oJz4nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlTdGFydFRhZyhhY3R1YWwpLCAnaHRtbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbXB0eUVsZW1lbnRzKSB7XG4gICAgICAgICAgb3V0cHV0Lm5sKCkuaW5kZW50TGluZXMoKTtcbiAgICAgICAgICBkaWZmTm9kZUxpc3RzKGFjdHVhbC5jaGlsZE5vZGVzLCBleHBlY3RlZC5jaGlsZE5vZGVzLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKTtcbiAgICAgICAgICBvdXRwdXQubmwoKS5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhhY3R1YWwpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignRE9NRWxlbWVudCcsICd0byBbb25seV0gaGF2ZSAoY2xhc3N8Y2xhc3NlcyknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGZsYWdzID0gdGhpcy5mbGFncztcbiAgICAgIGlmIChmbGFncy5vbmx5KSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIGhhdmUgYXR0cmlidXRlcycsIHtcbiAgICAgICAgICBjbGFzczogZnVuY3Rpb24gKGNsYXNzTmFtZSkge1xuICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB2YWx1ZSA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZsYWdzLm9ubHkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGFjdHVhbENsYXNzZXMuc29ydCgpLCAndG8gZXF1YWwnLCB2YWx1ZS5zb3J0KCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0LmFwcGx5KHRvcExldmVsRXhwZWN0LCBbYWN0dWFsQ2xhc3NlcywgJ3RvIGNvbnRhaW4nXS5jb25jYXQodmFsdWUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gaGF2ZSBhdHRyaWJ1dGVzJywgeyBjbGFzczogdmFsdWUgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01UZXh0Tm9kZScsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC5ub2RlVmFsdWUsICd0byBzYXRpc2Z5JywgZXhwZWN0LmZpbmRUeXBlT2YodmFsdWUpLm5hbWUgPT09ICdET01UZXh0Tm9kZScgPyB2YWx1ZS5ub2RlVmFsdWUgOiB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBjb252ZXJ0RE9NTm9kZVRvU2F0aXNmeVNwZWMobm9kZSwgaXNIdG1sKSB7XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gMSkge1xuICAgICAgICAvLyBET01FbGVtZW50XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgbmFtZTogaXNIdG1sID8gbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIDogbm9kZS5ub2RlTmFtZSxcbiAgICAgICAgICBhdHRyaWJ1dGVzOiB7fVxuICAgICAgICB9O1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUuYXR0cmlidXRlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICByZXN1bHQuYXR0cmlidXRlc1tub2RlLmF0dHJpYnV0ZXNbaV0ubmFtZV0gPSBpc0h0bWwgJiYgaXNCb29sZWFuQXR0cmlidXRlKG5vZGUuYXR0cmlidXRlc1tpXS5uYW1lKSA/IHRydWUgOiAobm9kZS5hdHRyaWJ1dGVzW2ldLnZhbHVlIHx8ICcnKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuY2hpbGRyZW4gPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwobm9kZS5jaGlsZE5vZGVzLCBmdW5jdGlvbiAoY2hpbGROb2RlKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIC8vIERPTVRleHROb2RlXG4gICAgICAgIHJldHVybiBub2RlLm5vZGVWYWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndG8gc2F0aXNmeTogTm9kZSB0eXBlICcgKyBub2RlLm5vZGVUeXBlICsgJyBpcyBub3QgeWV0IHN1cHBvcnRlZCBpbiB0aGUgdmFsdWUnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01Eb2N1bWVudEZyYWdtZW50JywgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IHN1YmplY3Qub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gICAgICB2YXIgdmFsdWVUeXBlID0gZXhwZWN0LmZpbmRUeXBlT2YodmFsdWUpO1xuICAgICAgaWYgKHZhbHVlVHlwZS5uYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgb3JpZ2luYWxWYWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmFyZ3NPdXRwdXQgPSBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgb3V0cHV0LmNvZGUob3JpZ2luYWxWYWx1ZSwgaXNIdG1sID8gJ2h0bWwnIDogJ3htbCcpO1xuICAgICAgICB9O1xuICAgICAgICB2YWx1ZSA9IGlzSHRtbCA/IHBhcnNlSHRtbCh2YWx1ZSwgdHJ1ZSwgdGhpcy50ZXN0RGVzY3JpcHRpb24pIDogcGFyc2VYbWwodmFsdWUsIHRoaXMudGVzdERlc2NyaXB0aW9uKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLm5vZGVUeXBlID09PSAxMSkge1xuICAgICAgICB2YWx1ZSA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCh2YWx1ZS5jaGlsZE5vZGVzLCBmdW5jdGlvbiAoY2hpbGROb2RlKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyhjaGlsZE5vZGUsIGlzSHRtbCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QuY2hpbGROb2RlcywgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01FbGVtZW50JywgJ3RvIFtleGhhdXN0aXZlbHldIHNhdGlzZnknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgdmFyIGlzSHRtbCA9IHN1YmplY3Qub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgZG9jdW1lbnRGcmFnbWVudCA9IGlzSHRtbCA/IHBhcnNlSHRtbCh2YWx1ZSwgdHJ1ZSwgdGhpcy50ZXN0RGVzY3JpcHRpb24pIDogcGFyc2VYbWwodmFsdWUsIHRoaXMudGVzdERlc2NyaXB0aW9uKTtcbiAgICAgICAgaWYgKGRvY3VtZW50RnJhZ21lbnQuY2hpbGROb2Rlcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUxFbGVtZW50IHRvIHNhdGlzZnkgc3RyaW5nOiBPbmx5IGEgc2luZ2xlIG5vZGUgaXMgc3VwcG9ydGVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9yaWdpbmFsVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgdmFsdWUgPSBkb2N1bWVudEZyYWdtZW50LmNoaWxkTm9kZXNbMF07XG4gICAgICAgIHRoaXMuYXJnc091dHB1dCA9IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICBvdXRwdXQuY29kZShvcmlnaW5hbFZhbHVlLCBpc0h0bWwgPyAnaHRtbCcgOiAneG1sJyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAoZXhwZWN0LmZpbmRUeXBlT2YodmFsdWUpLm5hbWUgPT09ICdET01FbGVtZW50Jykge1xuICAgICAgICB2YWx1ZSA9IGNvbnZlcnRET01Ob2RlVG9TYXRpc2Z5U3BlYyh2YWx1ZSwgaXNIdG1sKTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHZhciB1bnN1cHBvcnRlZE9wdGlvbnMgPSBPYmplY3Qua2V5cyh2YWx1ZSkuZmlsdGVyKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm4ga2V5ICE9PSAnYXR0cmlidXRlcycgJiYga2V5ICE9PSAnbmFtZScgJiYga2V5ICE9PSAnY2hpbGRyZW4nICYmIGtleSAhPT0gJ29ubHlBdHRyaWJ1dGVzJyAmJiBrZXkgIT09ICd0ZXh0Q29udGVudCc7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG9wdGlvbicgKyAodW5zdXBwb3J0ZWRPcHRpb25zLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnKSArICc6ICcgKyB1bnN1cHBvcnRlZE9wdGlvbnMuam9pbignLCAnKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIHByb21pc2VCeUtleSA9IHtcbiAgICAgICAgbmFtZTogZXhwZWN0LnByb21pc2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUubmFtZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChpc0h0bWwgPyBzdWJqZWN0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBzdWJqZWN0Lm5vZGVOYW1lLCAndG8gc2F0aXNmeScsIHZhbHVlLm5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIGNoaWxkcmVuOiBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5jaGlsZHJlbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUudGV4dENvbnRlbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGNoaWxkcmVuIGFuZCB0ZXh0Q29udGVudCBwcm9wZXJ0aWVzIGFyZSBub3Qgc3VwcG9ydGVkIHRvZ2V0aGVyJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbm9kZUxpc3RGb3JEaWZmaW5nID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBzdWJqZWN0LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgIG5vZGVMaXN0Rm9yRGlmZmluZy5wdXNoKHN1YmplY3QuY2hpbGROb2Rlc1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlTGlzdEZvckRpZmZpbmcuX2lzQXR0YWNoZWRET01Ob2RlTGlzdCA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3Qobm9kZUxpc3RGb3JEaWZmaW5nLCAndG8gc2F0aXNmeScsIHZhbHVlLmNoaWxkcmVuKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZS50ZXh0Q29udGVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChzdWJqZWN0LnRleHRDb250ZW50LCAndG8gc2F0aXNmeScsIHZhbHVlLnRleHRDb250ZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBhdHRyaWJ1dGVzOiB7fVxuICAgICAgfTtcblxuICAgICAgdmFyIG9ubHlBdHRyaWJ1dGVzID0gdmFsdWUgJiYgdmFsdWUub25seUF0dHJpYnV0ZXMgfHwgdGhpcy5mbGFncy5leGhhdXN0aXZlbHk7XG4gICAgICB2YXIgYXR0cnMgPSBnZXRBdHRyaWJ1dGVzKHN1YmplY3QpO1xuICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlcyA9IHZhbHVlICYmIHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcyA9IFtdO1xuXG4gICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVzID0gW2V4cGVjdGVkQXR0cmlidXRlc107XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUgPSB7fTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID0gdHJ1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZEF0dHJpYnV0ZXMgJiYgdHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlcyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lID0gZXhwZWN0ZWRBdHRyaWJ1dGVzO1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5rZXlzKGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLnB1c2goYXR0cmlidXRlTmFtZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgIHZhciBhdHRyaWJ1dGVWYWx1ZSA9IHN1YmplY3QuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID0gZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnICYmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gJ3N0cmluZycgfHwgQXJyYXkuaXNBcnJheShleHBlY3RlZEF0dHJpYnV0ZVZhbHVlKSkpIHtcbiAgICAgICAgICAgICAgdmFyIGFjdHVhbENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkQ2xhc3NlcyA9IGV4cGVjdGVkQXR0cmlidXRlVmFsdWU7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRDbGFzc2VzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkQ2xhc3NlcyA9IGdldENsYXNzTmFtZXNGcm9tQXR0cmlidXRlVmFsdWUoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGFjdHVhbENsYXNzZXMuc29ydCgpLCAndG8gZXF1YWwnLCBleHBlY3RlZENsYXNzZXMuc29ydCgpKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QuYXBwbHkodG9wTGV2ZWxFeHBlY3QsIFthY3R1YWxDbGFzc2VzLCAndG8gY29udGFpbiddLmNvbmNhdChleHBlY3RlZENsYXNzZXMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgIHZhciBleHBlY3RlZFN0eWxlT2JqO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9iaiA9IHN0eWxlU3RyaW5nVG9PYmplY3QoZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZS5zdHlsZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRTdHlsZU9iaiA9IGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGU7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAob25seUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYXR0cnMuc3R5bGUsICd0byBleGhhdXN0aXZlbHkgc2F0aXNmeScsIGV4cGVjdGVkU3R5bGVPYmopO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChhdHRycy5zdHlsZSwgJ3RvIHNhdGlzZnknLCBleHBlY3RlZFN0eWxlT2JqKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZEF0dHJpYnV0ZVZhbHVlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgIHRvcExldmVsRXhwZWN0KHN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpLCAndG8gYmUgdHJ1ZScpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgdG9wTGV2ZWxFeHBlY3Qoc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksICd0byBiZSBmYWxzZScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGF0dHJpYnV0ZVZhbHVlLCAndG8gc2F0aXNmeScsIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBwcm9taXNlQnlLZXkuYXR0cmlidXRlUHJlc2VuY2UgPSBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZCA9IFtdO1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBleHBlY3QoYXR0cnMsICdub3QgdG8gaGF2ZSBrZXknLCBhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5wdXNoKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICBleHBlY3QoYXR0cnMsICd0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgZXhwZWN0KE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCksICd0byBlcXVhbCcsIGF0dHJpYnV0ZU5hbWVzRXhwZWN0ZWRUb0JlRGVmaW5lZC5zb3J0KCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHBlY3QucHJvbWlzZS5hbGwocHJvbWlzZUJ5S2V5KS5jYXVnaHQoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZXhwZWN0LnByb21pc2Uuc2V0dGxlKHByb21pc2VCeUtleSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoe1xuICAgICAgICAgICAgZGlmZjogZnVuY3Rpb24gKG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgb3V0cHV0ID0gdGhpcztcbiAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgIC5wcmlzbVB1bmN0dWF0aW9uKCc8JylcbiAgICAgICAgICAgICAgICAgIC5wcmlzbVRhZyhpc0h0bWwgPyBzdWJqZWN0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBzdWJqZWN0Lm5vZGVOYW1lKTtcbiAgICAgICAgICAgICAgICB2YXIgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAocHJvbWlzZUJ5S2V5Lm5hbWUuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbmFtZUVycm9yID0gcHJvbWlzZUJ5S2V5Lm5hbWUucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgLmVycm9yKChuYW1lRXJyb3IgJiYgbmFtZUVycm9yLmdldExhYmVsKCkpIHx8ICdzaG91bGQgc2F0aXNmeScpXG4gICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKGluc3BlY3QodmFsdWUubmFtZSkpO1xuICAgICAgICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgIG91dHB1dC5zcChjYW5Db250aW51ZUxpbmUgPyAxIDogMiArIHN1YmplY3Qubm9kZU5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgIHdyaXRlQXR0cmlidXRlVG9NYWdpY1BlbihvdXRwdXQsIGF0dHJpYnV0ZU5hbWUsIGF0dHJzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgICAgICAgaWYgKChwcm9taXNlICYmIHByb21pc2UuaXNGdWxmaWxsZWQoKSkgfHwgKCFwcm9taXNlICYmICghb25seUF0dHJpYnV0ZXMgfHwgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpICE9PSAtMSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb21pc2UgJiYgdHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKHByb21pc2UucmVhc29uKCkuZ2V0RXJyb3JNZXNzYWdlKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9ubHlBdHRyaWJ1dGVzID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ3Nob3VsZCBiZSByZW1vdmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAubmwoKTtcbiAgICAgICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIXN1YmplY3QuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghcHJvbWlzZSB8fCBwcm9taXNlLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBwcm9taXNlICYmIHByb21pc2UucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAubmwoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnNwKDIgKyBzdWJqZWN0Lm5vZGVOYW1lLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVycm9yKCdtaXNzaW5nJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcmlzbUF0dHJOYW1lKGF0dHJpYnV0ZU5hbWUsICdodG1sJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoKGVyciAmJiBlcnIuZ2V0TGFiZWwoKSkgfHwgJ3Nob3VsZCBzYXRpc2Z5JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChpbnNwZWN0KGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG91dHB1dC5wcmlzbVB1bmN0dWF0aW9uKCc+Jyk7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuRXJyb3IgPSBwcm9taXNlQnlLZXkuY2hpbGRyZW4uaXNSZWplY3RlZCgpICYmIHByb21pc2VCeUtleS5jaGlsZHJlbi5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuRGlmZiA9IGNoaWxkcmVuRXJyb3IuZ2V0RGlmZihvdXRwdXQpO1xuICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuRGlmZiAmJiBjaGlsZHJlbkRpZmYuaW5saW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGNoaWxkcmVuRGlmZi5kaWZmKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgICAgICAgICAgICAuaSgpLmJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IHN1YmplY3QuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKS5ubCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGNoaWxkcmVuRXJyb3IuZ2V0RXJyb3JNZXNzYWdlKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5ubCgpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBzdWJqZWN0LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGluc3BlY3Qoc3ViamVjdC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhzdWJqZWN0KSwgJ2h0bWwnKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRpZmY6IG91dHB1dFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignRE9NRWxlbWVudCcsICd0byBbb25seV0gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMykge1xuICAgICAgICAgIHZhbHVlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RvIGhhdmUgYXR0cmlidXRlczogQXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZywgYW4gYXJyYXksIG9yIGFuIG9iamVjdCcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gc2F0aXNmeScsIHsgYXR0cmlidXRlczogdmFsdWUsIG9ubHlBdHRyaWJ1dGVzOiB0aGlzLmZsYWdzLm9ubHkgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01FbGVtZW50JywgJ3RvIGhhdmUgW25vXSAoY2hpbGR8Y2hpbGRyZW4pJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgcXVlcnksIGNtcCkge1xuICAgICAgaWYgKHRoaXMuZmxhZ3Mubm8pIHtcbiAgICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgcmV0dXJuIGV4cGVjdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdWJqZWN0LmNoaWxkTm9kZXMpLCAndG8gYmUgYW4gZW1wdHkgYXJyYXknKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHN1YmplY3QucXVlcnlTZWxlY3RvckFsbChxdWVyeSkpO1xuICAgICAgICB0aHJvdyBjaGlsZHJlbjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTUVsZW1lbnQnLCAndG8gaGF2ZSB0ZXh0JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC50ZXh0Q29udGVudCwgJ3RvIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKFsnRE9NRG9jdW1lbnQnLCAnRE9NRWxlbWVudCddLCAncXVlcmllZCBmb3IgW2ZpcnN0XScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgcXVlcnlSZXN1bHQ7XG5cbiAgICAgIHRoaXMuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG5cbiAgICAgIGlmICh0aGlzLmZsYWdzLmZpcnN0KSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHZhbHVlKTtcbiAgICAgICAgaWYgKCFxdWVyeVJlc3VsdCkge1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyh2YWx1ZSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHZhbHVlKTtcbiAgICAgICAgaWYgKHF1ZXJ5UmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyh2YWx1ZSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnNoaWZ0KGV4cGVjdCwgcXVlcnlSZXN1bHQsIDEpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbihbJ0RPTURvY3VtZW50JywgJ0RPTUVsZW1lbnQnXSwgJ3RvIGNvbnRhaW4gW25vXSBlbGVtZW50cyBtYXRjaGluZycsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICBpZiAodGhpcy5mbGFncy5ubykge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QucXVlcnlTZWxlY3RvckFsbCh2YWx1ZSksICd0byBzYXRpc2Z5JywgW10pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwodmFsdWUpLCAnbm90IHRvIHNhdGlzZnknLCBbXSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKFsnRE9NRG9jdW1lbnQnLCAnRE9NRWxlbWVudCddLCAnW25vdF0gdG8gbWF0Y2gnLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGV4cGVjdChtYXRjaGVzU2VsZWN0b3Ioc3ViamVjdCwgdmFsdWUpLCAndG8gYmUnLCAodGhpcy5mbGFncy5ub3QgPyBmYWxzZSA6IHRydWUpKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ3N0cmluZycsICd3aGVuIHBhcnNlZCBhcyAoaHRtbHxIVE1MKSBbZnJhZ21lbnRdJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgIHJldHVybiB0aGlzLnNoaWZ0KGV4cGVjdCwgcGFyc2VIdG1sKHN1YmplY3QsIHRoaXMuZmxhZ3MuZnJhZ21lbnQsIHRoaXMudGVzdERlc2NyaXB0aW9uKSwgMCk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdzdHJpbmcnLCAnd2hlbiBwYXJzZWQgYXMgKHhtbHxYTUwpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgIHJldHVybiB0aGlzLnNoaWZ0KGV4cGVjdCwgcGFyc2VYbWwoc3ViamVjdCwgdGhpcy50ZXN0RGVzY3JpcHRpb24pLCAwKTtcbiAgICB9KTtcbiAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGVsbSwgc2VsZWN0b3IpIHtcbiAgdmFyIG1hdGNoRnVudGlvbiA9IGVsbS5tYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ubW96TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxtLm1zTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxtLm9NYXRjaGVzU2VsZWN0b3IgfHxcbiAgICBlbG0ud2Via2l0TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICB2YXIgbm9kZSA9IHRoaXM7XG4gICAgICB2YXIgbm9kZXMgPSAobm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgdmFyIGkgPSAwO1xuXG4gICAgICB3aGlsZSAobm9kZXNbaV0gJiYgbm9kZXNbaV0gIT09IG5vZGUpIHtcbiAgICAgICAgaSArPSAxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gISFub2Rlc1tpXTtcbiAgICB9O1xuXG4gIHJldHVybiBtYXRjaEZ1bnRpb24uY2FsbChlbG0sIHNlbGVjdG9yKTtcbn07XG4iLCJ2YXIgYXJyYXlEaWZmID0gcmVxdWlyZSgnYXJyYXlkaWZmJyk7XG5cbmZ1bmN0aW9uIGV4dGVuZCh0YXJnZXQpIHtcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBPYmplY3Qua2V5cyhzb3VyY2UpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXJyYXlDaGFuZ2VzKGFjdHVhbCwgZXhwZWN0ZWQsIGVxdWFsLCBzaW1pbGFyKSB7XG4gICAgdmFyIG11dGF0ZWRBcnJheSA9IG5ldyBBcnJheShhY3R1YWwubGVuZ3RoKTtcblxuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgYWN0dWFsLmxlbmd0aDsgayArPSAxKSB7XG4gICAgICAgIG11dGF0ZWRBcnJheVtrXSA9IHtcbiAgICAgICAgICAgIHR5cGU6ICdzaW1pbGFyJyxcbiAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxba11cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAobXV0YXRlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgbXV0YXRlZEFycmF5W211dGF0ZWRBcnJheS5sZW5ndGggLSAxXS5sYXN0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBzaW1pbGFyID0gc2ltaWxhciB8fCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIHZhciBpdGVtc0RpZmYgPSBhcnJheURpZmYoW10uY29uY2F0KGFjdHVhbCksIFtdLmNvbmNhdChleHBlY3RlZCksIGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBlcXVhbChhLCBiKSB8fCBzaW1pbGFyKGEsIGIpO1xuICAgIH0pO1xuXG4gICAgdmFyIHJlbW92ZVRhYmxlID0gW107XG4gICAgZnVuY3Rpb24gb2Zmc2V0SW5kZXgoaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4ICsgKHJlbW92ZVRhYmxlW2luZGV4IC0gMV0gfHwgMCk7XG4gICAgfVxuXG4gICAgdmFyIHJlbW92ZXMgPSBpdGVtc0RpZmYuZmlsdGVyKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICByZXR1cm4gZGlmZkl0ZW0udHlwZSA9PT0gJ3JlbW92ZSc7XG4gICAgfSk7XG5cbiAgICB2YXIgcmVtb3Zlc0J5SW5kZXggPSB7fTtcbiAgICB2YXIgcmVtb3ZlZEl0ZW1zID0gMDtcbiAgICByZW1vdmVzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHZhciByZW1vdmVJbmRleCA9IHJlbW92ZWRJdGVtcyArIGRpZmZJdGVtLmluZGV4O1xuICAgICAgICBtdXRhdGVkQXJyYXkuc2xpY2UocmVtb3ZlSW5kZXgsIGRpZmZJdGVtLmhvd01hbnkgKyByZW1vdmVJbmRleCkuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgdi50eXBlID0gJ3JlbW92ZSc7XG4gICAgICAgIH0pO1xuICAgICAgICByZW1vdmVkSXRlbXMgKz0gZGlmZkl0ZW0uaG93TWFueTtcbiAgICAgICAgcmVtb3Zlc0J5SW5kZXhbZGlmZkl0ZW0uaW5kZXhdID0gcmVtb3ZlZEl0ZW1zO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gdXBkYXRlUmVtb3ZlVGFibGUoKSB7XG4gICAgICAgIHJlbW92ZWRJdGVtcyA9IDA7XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoYWN0dWFsLCBmdW5jdGlvbiAoXywgaW5kZXgpIHtcbiAgICAgICAgICAgIHJlbW92ZWRJdGVtcyArPSByZW1vdmVzQnlJbmRleFtpbmRleF0gfHwgMDtcbiAgICAgICAgICAgIHJlbW92ZVRhYmxlW2luZGV4XSA9IHJlbW92ZWRJdGVtcztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdXBkYXRlUmVtb3ZlVGFibGUoKTtcblxuICAgIHZhciBtb3ZlcyA9IGl0ZW1zRGlmZi5maWx0ZXIoZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHJldHVybiBkaWZmSXRlbS50eXBlID09PSAnbW92ZSc7XG4gICAgfSk7XG5cbiAgICB2YXIgbW92ZWRJdGVtcyA9IDA7XG4gICAgbW92ZXMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgdmFyIG1vdmVGcm9tSW5kZXggPSBvZmZzZXRJbmRleChkaWZmSXRlbS5mcm9tKTtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSBtdXRhdGVkQXJyYXkuc2xpY2UobW92ZUZyb21JbmRleCwgZGlmZkl0ZW0uaG93TWFueSArIG1vdmVGcm9tSW5kZXgpO1xuICAgICAgICB2YXIgYWRkZWQgPSByZW1vdmVkLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgcmV0dXJuIGV4dGVuZCh7fSwgdiwgeyBsYXN0OiBmYWxzZSwgdHlwZTogJ2luc2VydCcgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHYudHlwZSA9ICdyZW1vdmUnO1xuICAgICAgICB9KTtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShtdXRhdGVkQXJyYXksIFtvZmZzZXRJbmRleChkaWZmSXRlbS50byksIDBdLmNvbmNhdChhZGRlZCkpO1xuICAgICAgICBtb3ZlZEl0ZW1zICs9IGRpZmZJdGVtLmhvd01hbnk7XG4gICAgICAgIHJlbW92ZXNCeUluZGV4W2RpZmZJdGVtLmZyb21dID0gbW92ZWRJdGVtcztcbiAgICAgICAgdXBkYXRlUmVtb3ZlVGFibGUoKTtcbiAgICB9KTtcblxuICAgIHZhciBpbnNlcnRzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdpbnNlcnQnO1xuICAgIH0pO1xuXG4gICAgaW5zZXJ0cy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgYWRkZWQgPSBuZXcgQXJyYXkoZGlmZkl0ZW0udmFsdWVzLmxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRpZmZJdGVtLnZhbHVlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGFkZGVkW2ldID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBkaWZmSXRlbS52YWx1ZXNbaV1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShtdXRhdGVkQXJyYXksIFtvZmZzZXRJbmRleChkaWZmSXRlbS5pbmRleCksIDBdLmNvbmNhdChhZGRlZCkpO1xuICAgIH0pO1xuXG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgbXV0YXRlZEFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtLCBpbmRleCkge1xuICAgICAgICB2YXIgdHlwZSA9IGRpZmZJdGVtLnR5cGU7XG4gICAgICAgIGlmICh0eXBlID09PSAncmVtb3ZlJykge1xuICAgICAgICAgICAgb2Zmc2V0IC09IDE7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3NpbWlsYXInKSB7XG4gICAgICAgICAgICBkaWZmSXRlbS5leHBlY3RlZCA9IGV4cGVjdGVkW29mZnNldCArIGluZGV4XTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIGNvbmZsaWN0cyA9IG11dGF0ZWRBcnJheS5yZWR1Y2UoZnVuY3Rpb24gKGNvbmZsaWN0cywgaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS50eXBlID09PSAnc2ltaWxhcicgPyBjb25mbGljdHMgOiBjb25mbGljdHMgKyAxO1xuICAgIH0sIDApO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGMgPSAwOyBpIDwgTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKSAmJiAgYyA8PSBjb25mbGljdHM7IGkgKz0gMSkge1xuICAgICAgICB2YXIgZXhwZWN0ZWRUeXBlID0gdHlwZW9mIGV4cGVjdGVkW2ldO1xuICAgICAgICB2YXIgYWN0dWFsVHlwZSA9IHR5cGVvZiBhY3R1YWxbaV07XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgYWN0dWFsVHlwZSAhPT0gZXhwZWN0ZWRUeXBlIHx8XG4gICAgICAgICAgICAgICAgKChhY3R1YWxUeXBlID09PSAnb2JqZWN0JyB8fCBhY3R1YWxUeXBlID09PSAnc3RyaW5nJykgJiYgIXNpbWlsYXIoYWN0dWFsW2ldLCBleHBlY3RlZFtpXSkpIHx8XG4gICAgICAgICAgICAgICAgKGFjdHVhbFR5cGUgIT09ICdvYmplY3QnICYmIGFjdHVhbFR5cGUgIT09ICdzdHJpbmcnICYmICFlcXVhbChhY3R1YWxbaV0sIGV4cGVjdGVkW2ldKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBjICs9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYyA8PSBjb25mbGljdHMpIHtcbiAgICAgICAgbXV0YXRlZEFycmF5ID0gW107XG4gICAgICAgIHZhciBqO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgTWF0aC5taW4oYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTsgaiArPSAxKSB7XG4gICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3NpbWlsYXInLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxbal0sXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkW2pdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhY3R1YWwubGVuZ3RoIDwgZXhwZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKDsgaiA8IE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBleHBlY3RlZFtqXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICg7IGogPCBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpOyBqICs9IDEpIHtcbiAgICAgICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogYWN0dWFsW2pdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG11dGF0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBtdXRhdGVkQXJyYXlbbXV0YXRlZEFycmF5Lmxlbmd0aCAtIDFdLmxhc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbXV0YXRlZEFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIGlmIChkaWZmSXRlbS50eXBlID09PSAnc2ltaWxhcicgJiYgZXF1YWwoZGlmZkl0ZW0udmFsdWUsIGRpZmZJdGVtLmV4cGVjdGVkKSkge1xuICAgICAgICAgICAgZGlmZkl0ZW0udHlwZSA9ICdlcXVhbCc7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtdXRhdGVkQXJyYXk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBhcnJheURpZmY7XG5cbi8vIEJhc2VkIG9uIHNvbWUgcm91Z2ggYmVuY2htYXJraW5nLCB0aGlzIGFsZ29yaXRobSBpcyBhYm91dCBPKDJuKSB3b3JzdCBjYXNlLFxuLy8gYW5kIGl0IGNhbiBjb21wdXRlIGRpZmZzIG9uIHJhbmRvbSBhcnJheXMgb2YgbGVuZ3RoIDEwMjQgaW4gYWJvdXQgMzRtcyxcbi8vIHRob3VnaCBqdXN0IGEgZmV3IGNoYW5nZXMgb24gYW4gYXJyYXkgb2YgbGVuZ3RoIDEwMjQgdGFrZXMgYWJvdXQgMC41bXNcblxuYXJyYXlEaWZmLkluc2VydERpZmYgPSBJbnNlcnREaWZmO1xuYXJyYXlEaWZmLlJlbW92ZURpZmYgPSBSZW1vdmVEaWZmO1xuYXJyYXlEaWZmLk1vdmVEaWZmID0gTW92ZURpZmY7XG5cbmZ1bmN0aW9uIEluc2VydERpZmYoaW5kZXgsIHZhbHVlcykge1xuICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gIHRoaXMudmFsdWVzID0gdmFsdWVzO1xufVxuSW5zZXJ0RGlmZi5wcm90b3R5cGUudHlwZSA9ICdpbnNlcnQnO1xuSW5zZXJ0RGlmZi5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogdGhpcy50eXBlXG4gICwgaW5kZXg6IHRoaXMuaW5kZXhcbiAgLCB2YWx1ZXM6IHRoaXMudmFsdWVzXG4gIH07XG59O1xuXG5mdW5jdGlvbiBSZW1vdmVEaWZmKGluZGV4LCBob3dNYW55KSB7XG4gIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgdGhpcy5ob3dNYW55ID0gaG93TWFueTtcbn1cblJlbW92ZURpZmYucHJvdG90eXBlLnR5cGUgPSAncmVtb3ZlJztcblJlbW92ZURpZmYucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IHRoaXMudHlwZVxuICAsIGluZGV4OiB0aGlzLmluZGV4XG4gICwgaG93TWFueTogdGhpcy5ob3dNYW55XG4gIH07XG59O1xuXG5mdW5jdGlvbiBNb3ZlRGlmZihmcm9tLCB0bywgaG93TWFueSkge1xuICB0aGlzLmZyb20gPSBmcm9tO1xuICB0aGlzLnRvID0gdG87XG4gIHRoaXMuaG93TWFueSA9IGhvd01hbnk7XG59XG5Nb3ZlRGlmZi5wcm90b3R5cGUudHlwZSA9ICdtb3ZlJztcbk1vdmVEaWZmLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiB0aGlzLnR5cGVcbiAgLCBmcm9tOiB0aGlzLmZyb21cbiAgLCB0bzogdGhpcy50b1xuICAsIGhvd01hbnk6IHRoaXMuaG93TWFueVxuICB9O1xufTtcblxuZnVuY3Rpb24gc3RyaWN0RXF1YWwoYSwgYikge1xuICByZXR1cm4gYSA9PT0gYjtcbn1cblxuZnVuY3Rpb24gYXJyYXlEaWZmKGJlZm9yZSwgYWZ0ZXIsIGVxdWFsRm4pIHtcbiAgaWYgKCFlcXVhbEZuKSBlcXVhbEZuID0gc3RyaWN0RXF1YWw7XG5cbiAgLy8gRmluZCBhbGwgaXRlbXMgaW4gYm90aCB0aGUgYmVmb3JlIGFuZCBhZnRlciBhcnJheSwgYW5kIHJlcHJlc2VudCB0aGVtXG4gIC8vIGFzIG1vdmVzLiBNYW55IG9mIHRoZXNlIFwibW92ZXNcIiBtYXkgZW5kIHVwIGJlaW5nIGRpc2NhcmRlZCBpbiB0aGUgbGFzdFxuICAvLyBwYXNzIGlmIHRoZXkgYXJlIGZyb20gYW4gaW5kZXggdG8gdGhlIHNhbWUgaW5kZXgsIGJ1dCB3ZSBkb24ndCBrbm93IHRoaXNcbiAgLy8gdXAgZnJvbnQsIHNpbmNlIHdlIGhhdmVuJ3QgeWV0IG9mZnNldCB0aGUgaW5kaWNlcy5cbiAgLy8gXG4gIC8vIEFsc28ga2VlcCBhIG1hcCBvZiBhbGwgdGhlIGluZGljaWVzIGFjY291bnRlZCBmb3IgaW4gdGhlIGJlZm9yZSBhbmQgYWZ0ZXJcbiAgLy8gYXJyYXlzLiBUaGVzZSBtYXBzIGFyZSB1c2VkIG5leHQgdG8gY3JlYXRlIGluc2VydCBhbmQgcmVtb3ZlIGRpZmZzLlxuICB2YXIgYmVmb3JlTGVuZ3RoID0gYmVmb3JlLmxlbmd0aDtcbiAgdmFyIGFmdGVyTGVuZ3RoID0gYWZ0ZXIubGVuZ3RoO1xuICB2YXIgbW92ZXMgPSBbXTtcbiAgdmFyIGJlZm9yZU1hcmtlZCA9IHt9O1xuICB2YXIgYWZ0ZXJNYXJrZWQgPSB7fTtcbiAgZm9yICh2YXIgYmVmb3JlSW5kZXggPSAwOyBiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aDsgYmVmb3JlSW5kZXgrKykge1xuICAgIHZhciBiZWZvcmVJdGVtID0gYmVmb3JlW2JlZm9yZUluZGV4XTtcbiAgICBmb3IgKHZhciBhZnRlckluZGV4ID0gMDsgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoOyBhZnRlckluZGV4KyspIHtcbiAgICAgIGlmIChhZnRlck1hcmtlZFthZnRlckluZGV4XSkgY29udGludWU7XG4gICAgICBpZiAoIWVxdWFsRm4oYmVmb3JlSXRlbSwgYWZ0ZXJbYWZ0ZXJJbmRleF0pKSBjb250aW51ZTtcbiAgICAgIHZhciBmcm9tID0gYmVmb3JlSW5kZXg7XG4gICAgICB2YXIgdG8gPSBhZnRlckluZGV4O1xuICAgICAgdmFyIGhvd01hbnkgPSAwO1xuICAgICAgZG8ge1xuICAgICAgICBiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXgrK10gPSBhZnRlck1hcmtlZFthZnRlckluZGV4KytdID0gdHJ1ZTtcbiAgICAgICAgaG93TWFueSsrO1xuICAgICAgfSB3aGlsZSAoXG4gICAgICAgIGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoICYmXG4gICAgICAgIGFmdGVySW5kZXggPCBhZnRlckxlbmd0aCAmJlxuICAgICAgICBlcXVhbEZuKGJlZm9yZVtiZWZvcmVJbmRleF0sIGFmdGVyW2FmdGVySW5kZXhdKSAmJlxuICAgICAgICAhYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF1cbiAgICAgICk7XG4gICAgICBtb3Zlcy5wdXNoKG5ldyBNb3ZlRGlmZihmcm9tLCB0bywgaG93TWFueSkpO1xuICAgICAgYmVmb3JlSW5kZXgtLTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIENyZWF0ZSBhIHJlbW92ZSBmb3IgYWxsIG9mIHRoZSBpdGVtcyBpbiB0aGUgYmVmb3JlIGFycmF5IHRoYXQgd2VyZVxuICAvLyBub3QgbWFya2VkIGFzIGJlaW5nIG1hdGNoZWQgaW4gdGhlIGFmdGVyIGFycmF5IGFzIHdlbGxcbiAgdmFyIHJlbW92ZXMgPSBbXTtcbiAgZm9yIChiZWZvcmVJbmRleCA9IDA7IGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoOykge1xuICAgIGlmIChiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXhdKSB7XG4gICAgICBiZWZvcmVJbmRleCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IGJlZm9yZUluZGV4O1xuICAgIHZhciBob3dNYW55ID0gMDtcbiAgICB3aGlsZSAoYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGggJiYgIWJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleCsrXSkge1xuICAgICAgaG93TWFueSsrO1xuICAgIH1cbiAgICByZW1vdmVzLnB1c2gobmV3IFJlbW92ZURpZmYoaW5kZXgsIGhvd01hbnkpKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSBhbiBpbnNlcnQgZm9yIGFsbCBvZiB0aGUgaXRlbXMgaW4gdGhlIGFmdGVyIGFycmF5IHRoYXQgd2VyZVxuICAvLyBub3QgbWFya2VkIGFzIGJlaW5nIG1hdGNoZWQgaW4gdGhlIGJlZm9yZSBhcnJheSBhcyB3ZWxsXG4gIHZhciBpbnNlcnRzID0gW107XG4gIGZvciAoYWZ0ZXJJbmRleCA9IDA7IGFmdGVySW5kZXggPCBhZnRlckxlbmd0aDspIHtcbiAgICBpZiAoYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF0pIHtcbiAgICAgIGFmdGVySW5kZXgrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YXIgaW5kZXggPSBhZnRlckluZGV4O1xuICAgIHZhciBob3dNYW55ID0gMDtcbiAgICB3aGlsZSAoYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoICYmICFhZnRlck1hcmtlZFthZnRlckluZGV4KytdKSB7XG4gICAgICBob3dNYW55Kys7XG4gICAgfVxuICAgIHZhciB2YWx1ZXMgPSBhZnRlci5zbGljZShpbmRleCwgaW5kZXggKyBob3dNYW55KTtcbiAgICBpbnNlcnRzLnB1c2gobmV3IEluc2VydERpZmYoaW5kZXgsIHZhbHVlcykpO1xuICB9XG5cbiAgdmFyIGluc2VydHNMZW5ndGggPSBpbnNlcnRzLmxlbmd0aDtcbiAgdmFyIHJlbW92ZXNMZW5ndGggPSByZW1vdmVzLmxlbmd0aDtcbiAgdmFyIG1vdmVzTGVuZ3RoID0gbW92ZXMubGVuZ3RoO1xuICB2YXIgaSwgajtcblxuICAvLyBPZmZzZXQgc3Vic2VxdWVudCByZW1vdmVzIGFuZCBtb3ZlcyBieSByZW1vdmVzXG4gIHZhciBjb3VudCA9IDA7XG4gIGZvciAoaSA9IDA7IGkgPCByZW1vdmVzTGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmVtb3ZlID0gcmVtb3Zlc1tpXTtcbiAgICByZW1vdmUuaW5kZXggLT0gY291bnQ7XG4gICAgY291bnQgKz0gcmVtb3ZlLmhvd01hbnk7XG4gICAgZm9yIChqID0gMDsgaiA8IG1vdmVzTGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBtb3ZlID0gbW92ZXNbal07XG4gICAgICBpZiAobW92ZS5mcm9tID49IHJlbW92ZS5pbmRleCkgbW92ZS5mcm9tIC09IHJlbW92ZS5ob3dNYW55O1xuICAgIH1cbiAgfVxuXG4gIC8vIE9mZnNldCBtb3ZlcyBieSBpbnNlcnRzXG4gIGZvciAoaSA9IGluc2VydHNMZW5ndGg7IGktLTspIHtcbiAgICB2YXIgaW5zZXJ0ID0gaW5zZXJ0c1tpXTtcbiAgICB2YXIgaG93TWFueSA9IGluc2VydC52YWx1ZXMubGVuZ3RoO1xuICAgIGZvciAoaiA9IG1vdmVzTGVuZ3RoOyBqLS07KSB7XG4gICAgICB2YXIgbW92ZSA9IG1vdmVzW2pdO1xuICAgICAgaWYgKG1vdmUudG8gPj0gaW5zZXJ0LmluZGV4KSBtb3ZlLnRvIC09IGhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT2Zmc2V0IHRoZSB0byBvZiBtb3ZlcyBieSBsYXRlciBtb3Zlc1xuICBmb3IgKGkgPSBtb3Zlc0xlbmd0aDsgaS0tID4gMTspIHtcbiAgICB2YXIgbW92ZSA9IG1vdmVzW2ldO1xuICAgIGlmIChtb3ZlLnRvID09PSBtb3ZlLmZyb20pIGNvbnRpbnVlO1xuICAgIGZvciAoaiA9IGk7IGotLTspIHtcbiAgICAgIHZhciBlYXJsaWVyID0gbW92ZXNbal07XG4gICAgICBpZiAoZWFybGllci50byA+PSBtb3ZlLnRvKSBlYXJsaWVyLnRvIC09IG1vdmUuaG93TWFueTtcbiAgICAgIGlmIChlYXJsaWVyLnRvID49IG1vdmUuZnJvbSkgZWFybGllci50byArPSBtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT25seSBvdXRwdXQgbW92ZXMgdGhhdCBlbmQgdXAgaGF2aW5nIGFuIGVmZmVjdCBhZnRlciBvZmZzZXR0aW5nXG4gIHZhciBvdXRwdXRNb3ZlcyA9IFtdO1xuXG4gIC8vIE9mZnNldCB0aGUgZnJvbSBvZiBtb3ZlcyBieSBlYXJsaWVyIG1vdmVzXG4gIGZvciAoaSA9IDA7IGkgPCBtb3Zlc0xlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG1vdmUgPSBtb3Zlc1tpXTtcbiAgICBpZiAobW92ZS50byA9PT0gbW92ZS5mcm9tKSBjb250aW51ZTtcbiAgICBvdXRwdXRNb3Zlcy5wdXNoKG1vdmUpO1xuICAgIGZvciAoaiA9IGkgKyAxOyBqIDwgbW92ZXNMZW5ndGg7IGorKykge1xuICAgICAgdmFyIGxhdGVyID0gbW92ZXNbal07XG4gICAgICBpZiAobGF0ZXIuZnJvbSA+PSBtb3ZlLmZyb20pIGxhdGVyLmZyb20gLT0gbW92ZS5ob3dNYW55O1xuICAgICAgaWYgKGxhdGVyLmZyb20gPj0gbW92ZS50bykgbGF0ZXIuZnJvbSArPSBtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlbW92ZXMuY29uY2F0KG91dHB1dE1vdmVzLCBpbnNlcnRzKTtcbn1cbiIsIlxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNvcmUuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxudmFyIHNlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gd2luZG93IDoge307XG5cbi8qKlxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xuICogTUlUIGxpY2Vuc2UgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHAvXG4gKiBAYXV0aG9yIExlYSBWZXJvdSBodHRwOi8vbGVhLnZlcm91Lm1lXG4gKi9cblxudmFyIFByaXNtID0gKGZ1bmN0aW9uKCl7XG5cbi8vIFByaXZhdGUgaGVscGVyIHZhcnNcbnZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKD8hXFwqKShcXHcrKVxcYi9pO1xuXG52YXIgXyA9IHNlbGYuUHJpc20gPSB7XG5cdHV0aWw6IHtcblx0XHR0eXBlOiBmdW5jdGlvbiAobykgeyBcblx0XHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykubWF0Y2goL1xcW29iamVjdCAoXFx3KylcXF0vKVsxXTtcblx0XHR9LFxuXHRcdFxuXHRcdC8vIERlZXAgY2xvbmUgYSBsYW5ndWFnZSBkZWZpbml0aW9uIChlLmcuIHRvIGV4dGVuZCBpdClcblx0XHRjbG9uZTogZnVuY3Rpb24gKG8pIHtcblx0XHRcdHZhciB0eXBlID0gXy51dGlsLnR5cGUobyk7XG5cblx0XHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0XHRjYXNlICdPYmplY3QnOlxuXHRcdFx0XHRcdHZhciBjbG9uZSA9IHt9O1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGZvciAodmFyIGtleSBpbiBvKSB7XG5cdFx0XHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdFx0XHRcdGNsb25lW2tleV0gPSBfLnV0aWwuY2xvbmUob1trZXldKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRjYXNlICdBcnJheSc6XG5cdFx0XHRcdFx0cmV0dXJuIG8uc2xpY2UoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIG87XG5cdFx0fVxuXHR9LFxuXHRcblx0bGFuZ3VhZ2VzOiB7XG5cdFx0ZXh0ZW5kOiBmdW5jdGlvbiAoaWQsIHJlZGVmKSB7XG5cdFx0XHR2YXIgbGFuZyA9IF8udXRpbC5jbG9uZShfLmxhbmd1YWdlc1tpZF0pO1xuXHRcdFx0XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gcmVkZWYpIHtcblx0XHRcdFx0bGFuZ1trZXldID0gcmVkZWZba2V5XTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIGxhbmc7XG5cdFx0fSxcblx0XHRcblx0XHQvLyBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcblx0XHRpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uIChpbnNpZGUsIGJlZm9yZSwgaW5zZXJ0LCByb290KSB7XG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xuXHRcdFx0dmFyIHJldCA9IHt9O1xuXHRcdFx0XHRcblx0XHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblx0XHRcdFxuXHRcdFx0XHRpZiAoZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRpZiAodG9rZW4gPT0gYmVmb3JlKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldFtuZXdUb2tlbl0gPSBpbnNlcnRbbmV3VG9rZW5dO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xuXHRcdH0sXG5cdFx0XG5cdFx0Ly8gVHJhdmVyc2UgYSBsYW5ndWFnZSBkZWZpbml0aW9uIHdpdGggRGVwdGggRmlyc3QgU2VhcmNoXG5cdFx0REZTOiBmdW5jdGlvbihvLCBjYWxsYmFjaykge1xuXHRcdFx0Zm9yICh2YXIgaSBpbiBvKSB7XG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwobywgaSwgb1tpXSk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoXy51dGlsLnR5cGUobykgPT09ICdPYmplY3QnKSB7XG5cdFx0XHRcdFx0Xy5sYW5ndWFnZXMuREZTKG9baV0sIGNhbGxiYWNrKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRoaWdobGlnaHRBbGw6IGZ1bmN0aW9uKGFzeW5jLCBjYWxsYmFjaykge1xuXHRcdHZhciBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2NvZGVbY2xhc3MqPVwibGFuZ3VhZ2UtXCJdLCBbY2xhc3MqPVwibGFuZ3VhZ2UtXCJdIGNvZGUsIGNvZGVbY2xhc3MqPVwibGFuZy1cIl0sIFtjbGFzcyo9XCJsYW5nLVwiXSBjb2RlJyk7XG5cblx0XHRmb3IgKHZhciBpPTAsIGVsZW1lbnQ7IGVsZW1lbnQgPSBlbGVtZW50c1tpKytdOykge1xuXHRcdFx0Xy5oaWdobGlnaHRFbGVtZW50KGVsZW1lbnQsIGFzeW5jID09PSB0cnVlLCBjYWxsYmFjayk7XG5cdFx0fVxuXHR9LFxuXHRcdFxuXHRoaWdobGlnaHRFbGVtZW50OiBmdW5jdGlvbihlbGVtZW50LCBhc3luYywgY2FsbGJhY2spIHtcblx0XHQvLyBGaW5kIGxhbmd1YWdlXG5cdFx0dmFyIGxhbmd1YWdlLCBncmFtbWFyLCBwYXJlbnQgPSBlbGVtZW50O1xuXHRcdFxuXHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0fVxuXHRcdFxuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdGxhbmd1YWdlID0gKHBhcmVudC5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywnJ10pWzFdO1xuXHRcdFx0Z3JhbW1hciA9IF8ubGFuZ3VhZ2VzW2xhbmd1YWdlXTtcblx0XHR9XG5cblx0XHRpZiAoIWdyYW1tYXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBlbGVtZW50LCBpZiBub3QgcHJlc2VudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cdFx0XG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBwYXJlbnQsIGZvciBzdHlsaW5nXG5cdFx0cGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuXHRcdFxuXHRcdGlmICgvcHJlL2kudGVzdChwYXJlbnQubm9kZU5hbWUpKSB7XG5cdFx0XHRwYXJlbnQuY2xhc3NOYW1lID0gcGFyZW50LmNsYXNzTmFtZS5yZXBsYWNlKGxhbmcsICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykgKyAnIGxhbmd1YWdlLScgKyBsYW5ndWFnZTsgXG5cdFx0fVxuXG5cdFx0dmFyIGNvZGUgPSBlbGVtZW50LnRleHRDb250ZW50O1xuXHRcdFxuXHRcdGlmKCFjb2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdGNvZGUgPSBjb2RlLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoL1xcdTAwYTAvZywgJyAnKTtcblx0XHRcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0ZWxlbWVudDogZWxlbWVudCxcblx0XHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRcdGdyYW1tYXI6IGdyYW1tYXIsXG5cdFx0XHRjb2RlOiBjb2RlXG5cdFx0fTtcblx0XHRcblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XG5cdFx0aWYgKGFzeW5jICYmIHNlbGYuV29ya2VyKSB7XG5cdFx0XHR2YXIgd29ya2VyID0gbmV3IFdvcmtlcihfLmZpbGVuYW1lKTtcdFxuXHRcdFx0XG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBUb2tlbi5zdHJpbmdpZnkoSlNPTi5wYXJzZShldnQuZGF0YSksIGxhbmd1YWdlKTtcblxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblx0XHRcdFx0XG5cdFx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZW52LmVsZW1lbnQpO1xuXHRcdFx0XHRfLmhvb2tzLnJ1bignYWZ0ZXItaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcdH07XG5cdFx0XHRcblx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdGxhbmd1YWdlOiBlbnYubGFuZ3VhZ2UsXG5cdFx0XHRcdGNvZGU6IGVudi5jb2RlXG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IF8uaGlnaGxpZ2h0KGVudi5jb2RlLCBlbnYuZ3JhbW1hciwgZW52Lmxhbmd1YWdlKVxuXG5cdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cdFx0XHRcblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZWxlbWVudCk7XG5cdFx0XHRcblx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdH1cblx0fSxcblx0XG5cdGhpZ2hsaWdodDogZnVuY3Rpb24gKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShfLnRva2VuaXplKHRleHQsIGdyYW1tYXIpLCBsYW5ndWFnZSk7XG5cdH0sXG5cdFxuXHR0b2tlbml6ZTogZnVuY3Rpb24odGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xuXHRcdFxuXHRcdHZhciBzdHJhcnIgPSBbdGV4dF07XG5cdFx0XG5cdFx0dmFyIHJlc3QgPSBncmFtbWFyLnJlc3Q7XG5cdFx0XG5cdFx0aWYgKHJlc3QpIHtcblx0XHRcdGZvciAodmFyIHRva2VuIGluIHJlc3QpIHtcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcblx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XG5cdFx0dG9rZW5sb29wOiBmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XG5cdFx0XHRpZighZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikgfHwgIWdyYW1tYXJbdG9rZW5dKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR2YXIgcGF0dGVybiA9IGdyYW1tYXJbdG9rZW5dLCBcblx0XHRcdFx0aW5zaWRlID0gcGF0dGVybi5pbnNpZGUsXG5cdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcblx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IDA7XG5cdFx0XHRcblx0XHRcdHBhdHRlcm4gPSBwYXR0ZXJuLnBhdHRlcm4gfHwgcGF0dGVybjtcblx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgaT0wOyBpPHN0cmFyci5sZW5ndGg7IGkrKykgeyAvLyBEb27igJl0IGNhY2hlIGxlbmd0aCBhcyBpdCBjaGFuZ2VzIGR1cmluZyB0aGUgbG9vcFxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHN0ciA9IHN0cmFycltpXTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmIChzdHJhcnIubGVuZ3RoID4gdGV4dC5sZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxuXHRcdFx0XHRcdGJyZWFrIHRva2VubG9vcDtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0aWYgKHN0ciBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gMDtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBtYXRjaCA9IHBhdHRlcm4uZXhlYyhzdHIpO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdFx0aWYobG9va2JlaGluZCkge1xuXHRcdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IG1hdGNoWzFdLmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4IC0gMSArIGxvb2tiZWhpbmRMZW5ndGgsXG5cdFx0XHRcdFx0ICAgIG1hdGNoID0gbWF0Y2hbMF0uc2xpY2UobG9va2JlaGluZExlbmd0aCksXG5cdFx0XHRcdFx0ICAgIGxlbiA9IG1hdGNoLmxlbmd0aCxcblx0XHRcdFx0XHQgICAgdG8gPSBmcm9tICsgbGVuLFxuXHRcdFx0XHRcdFx0YmVmb3JlID0gc3RyLnNsaWNlKDAsIGZyb20gKyAxKSxcblx0XHRcdFx0XHRcdGFmdGVyID0gc3RyLnNsaWNlKHRvICsgMSk7IFxuXG5cdFx0XHRcdFx0dmFyIGFyZ3MgPSBbaSwgMV07XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYgKGJlZm9yZSkge1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHZhciB3cmFwcGVkID0gbmV3IFRva2VuKHRva2VuLCBpbnNpZGU/IF8udG9rZW5pemUobWF0Y2gsIGluc2lkZSkgOiBtYXRjaCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YXJncy5wdXNoKHdyYXBwZWQpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmIChhZnRlcikge1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGFmdGVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0QXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShzdHJhcnIsIGFyZ3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0cmFycjtcblx0fSxcblx0XG5cdGhvb2tzOiB7XG5cdFx0YWxsOiB7fSxcblx0XHRcblx0XHRhZGQ6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xuXHRcdFx0dmFyIGhvb2tzID0gXy5ob29rcy5hbGw7XG5cdFx0XHRcblx0XHRcdGhvb2tzW25hbWVdID0gaG9va3NbbmFtZV0gfHwgW107XG5cdFx0XHRcblx0XHRcdGhvb2tzW25hbWVdLnB1c2goY2FsbGJhY2spO1xuXHRcdH0sXG5cdFx0XG5cdFx0cnVuOiBmdW5jdGlvbiAobmFtZSwgZW52KSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tzID0gXy5ob29rcy5hbGxbbmFtZV07XG5cdFx0XHRcblx0XHRcdGlmICghY2FsbGJhY2tzIHx8ICFjYWxsYmFja3MubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgaT0wLCBjYWxsYmFjazsgY2FsbGJhY2sgPSBjYWxsYmFja3NbaSsrXTspIHtcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50KSB7XG5cdHRoaXMudHlwZSA9IHR5cGU7XG5cdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG59O1xuXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XG5cdGlmICh0eXBlb2YgbyA9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBvO1xuXHR9XG5cblx0aWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoZWxlbWVudCwgbGFuZ3VhZ2UsIG8pO1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cdFxuXHR2YXIgZW52ID0ge1xuXHRcdHR5cGU6IG8udHlwZSxcblx0XHRjb250ZW50OiBUb2tlbi5zdHJpbmdpZnkoby5jb250ZW50LCBsYW5ndWFnZSwgcGFyZW50KSxcblx0XHR0YWc6ICdzcGFuJyxcblx0XHRjbGFzc2VzOiBbJ3Rva2VuJywgby50eXBlXSxcblx0XHRhdHRyaWJ1dGVzOiB7fSxcblx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0cGFyZW50OiBwYXJlbnRcblx0fTtcblx0XG5cdGlmIChlbnYudHlwZSA9PSAnY29tbWVudCcpIHtcblx0XHRlbnYuYXR0cmlidXRlc1snc3BlbGxjaGVjayddID0gJ3RydWUnO1xuXHR9XG5cdFxuXHRfLmhvb2tzLnJ1bignd3JhcCcsIGVudik7XG5cdFxuXHR2YXIgYXR0cmlidXRlcyA9ICcnO1xuXHRcblx0Zm9yICh2YXIgbmFtZSBpbiBlbnYuYXR0cmlidXRlcykge1xuXHRcdGF0dHJpYnV0ZXMgKz0gbmFtZSArICc9XCInICsgKGVudi5hdHRyaWJ1dGVzW25hbWVdIHx8ICcnKSArICdcIic7XG5cdH1cblx0XG5cdHJldHVybiAnPCcgKyBlbnYudGFnICsgJyBjbGFzcz1cIicgKyBlbnYuY2xhc3Nlcy5qb2luKCcgJykgKyAnXCIgJyArIGF0dHJpYnV0ZXMgKyAnPicgKyBlbnYuY29udGVudCArICc8LycgKyBlbnYudGFnICsgJz4nO1xuXHRcbn07XG5cbmlmICghc2VsZi5kb2N1bWVudCkge1xuXHRpZiAoIXNlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHRcdC8vIGluIE5vZGUuanNcblx0XHRyZXR1cm4gc2VsZi5QcmlzbTtcblx0fVxuIFx0Ly8gSW4gd29ya2VyXG5cdHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGV2dCkge1xuXHRcdHZhciBtZXNzYWdlID0gSlNPTi5wYXJzZShldnQuZGF0YSksXG5cdFx0ICAgIGxhbmcgPSBtZXNzYWdlLmxhbmd1YWdlLFxuXHRcdCAgICBjb2RlID0gbWVzc2FnZS5jb2RlO1xuXHRcdFxuXHRcdHNlbGYucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoXy50b2tlbml6ZShjb2RlLCBfLmxhbmd1YWdlc1tsYW5nXSkpKTtcblx0XHRzZWxmLmNsb3NlKCk7XG5cdH0sIGZhbHNlKTtcblx0XG5cdHJldHVybiBzZWxmLlByaXNtO1xufVxuXG4vLyBHZXQgY3VycmVudCBzY3JpcHQgYW5kIGhpZ2hsaWdodFxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKTtcblxuc2NyaXB0ID0gc2NyaXB0W3NjcmlwdC5sZW5ndGggLSAxXTtcblxuaWYgKHNjcmlwdCkge1xuXHRfLmZpbGVuYW1lID0gc2NyaXB0LnNyYztcblx0XG5cdGlmIChkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICYmICFzY3JpcHQuaGFzQXR0cmlidXRlKCdkYXRhLW1hbnVhbCcpKSB7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIF8uaGlnaGxpZ2h0QWxsKTtcblx0fVxufVxuXG5yZXR1cm4gc2VsZi5QcmlzbTtcblxufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJpc207XG59XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XG5cdCdjb21tZW50JzogLyZsdDshLS1bXFx3XFxXXSo/LS0+L2csXG5cdCdwcm9sb2cnOiAvJmx0O1xcPy4rP1xcPz4vLFxuXHQnZG9jdHlwZSc6IC8mbHQ7IURPQ1RZUEUuKz8+Lyxcblx0J2NkYXRhJzogLyZsdDshXFxbQ0RBVEFcXFtbXFx3XFxXXSo/XV0+L2ksXG5cdCd0YWcnOiB7XG5cdFx0cGF0dGVybjogLyZsdDtcXC8/W1xcdzotXStcXHMqKD86XFxzK1tcXHc6LV0rKD86PSg/OihcInwnKShcXFxcP1tcXHdcXFddKSo/XFwxfFteXFxzJ1wiPj1dKykpP1xccyopKlxcLz8+L2dpLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0cGF0dGVybjogL14mbHQ7XFwvP1tcXHc6LV0rL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eJmx0O1xcLz8vLFxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXltcXHctXSs/Oi9cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdhdHRyLXZhbHVlJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvPSg/OignfFwiKVtcXHdcXFddKj8oXFwxKXxbXlxccz5dKykvZ2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC89fD58XCIvZ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+L2csXG5cdFx0XHQnYXR0ci1uYW1lJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvW1xcdzotXSsvZyxcblx0XHRcdFx0aW5zaWRlOiB7XG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW1xcdy1dKz86L1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9XG5cdH0sXG5cdCdlbnRpdHknOiAvJmFtcDsjP1tcXGRhLXpdezEsOH07L2dpXG59O1xuXG4vLyBQbHVnaW4gdG8gbWFrZSBlbnRpdHkgdGl0bGUgc2hvdyB0aGUgcmVhbCBlbnRpdHksIGlkZWEgYnkgUm9tYW4gS29tYXJvdlxuUHJpc20uaG9va3MuYWRkKCd3cmFwJywgZnVuY3Rpb24oZW52KSB7XG5cblx0aWYgKGVudi50eXBlID09PSAnZW50aXR5Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWyd0aXRsZSddID0gZW52LmNvbnRlbnQucmVwbGFjZSgvJmFtcDsvLCAnJicpO1xuXHR9XG59KTtcblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWNzcy5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuY3NzID0ge1xuXHQnY29tbWVudCc6IC9cXC9cXCpbXFx3XFxXXSo/XFwqXFwvL2csXG5cdCdhdHJ1bGUnOiB7XG5cdFx0cGF0dGVybjogL0BbXFx3LV0rPy4qPyg7fCg/PVxccyp7KSkvZ2ksXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHQncHVuY3R1YXRpb24nOiAvWzs6XS9nXG5cdFx0fVxuXHR9LFxuXHQndXJsJzogL3VybFxcKChbXCInXT8pLio/XFwxXFwpL2dpLFxuXHQnc2VsZWN0b3InOiAvW15cXHtcXH1cXHNdW15cXHtcXH07XSooPz1cXHMqXFx7KS9nLFxuXHQncHJvcGVydHknOiAvKFxcYnxcXEIpW1xcdy1dKyg/PVxccyo6KS9pZyxcblx0J3N0cmluZyc6IC8oXCJ8JykoXFxcXD8uKSo/XFwxL2csXG5cdCdpbXBvcnRhbnQnOiAvXFxCIWltcG9ydGFudFxcYi9naSxcblx0J2lnbm9yZSc6IC8mKGx0fGd0fGFtcCk7L2dpLFxuXHQncHVuY3R1YXRpb24nOiAvW1xce1xcfTs6XS9nXG59O1xuXG5pZiAoUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cCkge1xuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xuXHRcdCdzdHlsZSc6IHtcblx0XHRcdHBhdHRlcm46IC8oJmx0O3w8KXN0eWxlW1xcd1xcV10qPyg+fCZndDspW1xcd1xcV10qPygmbHQ7fDwpXFwvc3R5bGUoPnwmZ3Q7KS9pZyxcblx0XHRcdGluc2lkZToge1xuXHRcdFx0XHQndGFnJzoge1xuXHRcdFx0XHRcdHBhdHRlcm46IC8oJmx0O3w8KXN0eWxlW1xcd1xcV10qPyg+fCZndDspfCgmbHQ7fDwpXFwvc3R5bGUoPnwmZ3Q7KS9pZyxcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5tYXJrdXAudGFnLmluc2lkZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZXN0OiBQcmlzbS5sYW5ndWFnZXMuY3NzXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1jbGlrZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuY2xpa2UgPSB7XG5cdCdjb21tZW50Jzoge1xuXHRcdHBhdHRlcm46IC8oXnxbXlxcXFxdKShcXC9cXCpbXFx3XFxXXSo/XFwqXFwvfChefFteOl0pXFwvXFwvLio/KFxccj9cXG58JCkpL2csXG5cdFx0bG9va2JlaGluZDogdHJ1ZVxuXHR9LFxuXHQnc3RyaW5nJzogLyhcInwnKShcXFxcPy4pKj9cXDEvZyxcblx0J2NsYXNzLW5hbWUnOiB7XG5cdFx0cGF0dGVybjogLygoPzooPzpjbGFzc3xpbnRlcmZhY2V8ZXh0ZW5kc3xpbXBsZW1lbnRzfHRyYWl0fGluc3RhbmNlb2Z8bmV3KVxccyspfCg/OmNhdGNoXFxzK1xcKCkpW2EtejAtOV9cXC5cXFxcXSsvaWcsXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdHB1bmN0dWF0aW9uOiAvKFxcLnxcXFxcKS9cblx0XHR9XG5cdH0sXG5cdCdrZXl3b3JkJzogL1xcYihpZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxuZXd8dHJ5fHRocm93fGNhdGNofGZpbmFsbHl8bnVsbHxicmVha3xjb250aW51ZSlcXGIvZyxcblx0J2Jvb2xlYW4nOiAvXFxiKHRydWV8ZmFsc2UpXFxiL2csXG5cdCdmdW5jdGlvbic6IHtcblx0XHRwYXR0ZXJuOiAvW2EtejAtOV9dK1xcKC9pZyxcblx0XHRpbnNpZGU6IHtcblx0XHRcdHB1bmN0dWF0aW9uOiAvXFwoL1xuXHRcdH1cblx0fSxcblx0J251bWJlcic6IC9cXGItPygweFtcXGRBLUZhLWZdK3xcXGQqXFwuP1xcZCsoW0VlXS0/XFxkKyk/KVxcYi9nLFxuXHQnb3BlcmF0b3InOiAvWy0rXXsxLDJ9fCF8Jmx0Oz0/fD49P3w9ezEsM318KCZhbXA7KXsxLDJ9fFxcfD9cXHx8XFw/fFxcKnxcXC98XFx+fFxcXnxcXCUvZyxcblx0J2lnbm9yZSc6IC8mKGx0fGd0fGFtcCk7L2dpLFxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vZ1xufTtcblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcblx0J2tleXdvcmQnOiAvXFxiKHZhcnxsZXR8aWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258Z2V0fHNldHxuZXd8d2l0aHx0eXBlb2Z8dHJ5fHRocm93fGNhdGNofGZpbmFsbHl8bnVsbHxicmVha3xjb250aW51ZXx0aGlzKVxcYi9nLFxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfFxcZCpcXC4/XFxkKyhbRWVdLT9cXGQrKT98TmFOfC0/SW5maW5pdHkpXFxiL2dcbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ2tleXdvcmQnLCB7XG5cdCdyZWdleCc6IHtcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcWy4rP118XFxcXC58W14vXFxyXFxuXSkrXFwvW2dpbV17MCwzfSg/PVxccyooJHxbXFxyXFxuLC47fSldKSkvZyxcblx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdH1cbn0pO1xuXG5pZiAoUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cCkge1xuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xuXHRcdCdzY3JpcHQnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKCZsdDt8PClzY3JpcHRbXFx3XFxXXSo/KD58Jmd0OylbXFx3XFxXXSo/KCZsdDt8PClcXC9zY3JpcHQoPnwmZ3Q7KS9pZyxcblx0XHRcdGluc2lkZToge1xuXHRcdFx0XHQndGFnJzoge1xuXHRcdFx0XHRcdHBhdHRlcm46IC8oJmx0O3w8KXNjcmlwdFtcXHdcXFddKj8oPnwmZ3Q7KXwoJmx0O3w8KVxcL3NjcmlwdCg+fCZndDspL2lnLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLWZpbGUtaGlnaGxpZ2h0LmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbihmdW5jdGlvbigpe1xuXG5pZiAoIXNlbGYuUHJpc20gfHwgIXNlbGYuZG9jdW1lbnQgfHwgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IpIHtcblx0cmV0dXJuO1xufVxuXG52YXIgRXh0ZW5zaW9ucyA9IHtcblx0J2pzJzogJ2phdmFzY3JpcHQnLFxuXHQnaHRtbCc6ICdtYXJrdXAnLFxuXHQnc3ZnJzogJ21hcmt1cCdcbn07XG5cbkFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ByZVtkYXRhLXNyY10nKSkuZm9yRWFjaChmdW5jdGlvbihwcmUpIHtcblx0dmFyIHNyYyA9IHByZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG5cdHZhciBleHRlbnNpb24gPSAoc3JjLm1hdGNoKC9cXC4oXFx3KykkLykgfHwgWywnJ10pWzFdO1xuXHR2YXIgbGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xuXHRcblx0dmFyIGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjb2RlJyk7XG5cdGNvZGUuY2xhc3NOYW1lID0gJ2xhbmd1YWdlLScgKyBsYW5ndWFnZTtcblx0XG5cdHByZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcblx0Y29kZS50ZXh0Q29udGVudCA9ICdMb2FkaW5n4oCmJztcblx0XG5cdHByZS5hcHBlbmRDaGlsZChjb2RlKTtcblx0XG5cdHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0XG5cdHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpO1xuXG5cdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XG5cdFx0XHRpZiAoeGhyLnN0YXR1cyA8IDQwMCAmJiB4aHIucmVzcG9uc2VUZXh0KSB7XG5cdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSB4aHIucmVzcG9uc2VUZXh0O1xuXHRcdFx0XG5cdFx0XHRcdFByaXNtLmhpZ2hsaWdodEVsZW1lbnQoY29kZSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xuXHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvciAnICsgeGhyLnN0YXR1cyArICcgd2hpbGUgZmV0Y2hpbmcgZmlsZTogJyArIHhoci5zdGF0dXNUZXh0O1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yOiBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIGlzIGVtcHR5Jztcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cdFxuXHR4aHIuc2VuZChudWxsKTtcbn0pO1xuXG59KSgpOyIsInZhciBwcmlzbSA9IHJlcXVpcmUoJy4uLzNyZHBhcnR5L3ByaXNtJyksXG4gICAgZGVmYXVsdFRoZW1lID0ge1xuICAgICAgICAvLyBBZGFwdGVkIGZyb20gdGhlIGRlZmF1bHQgUHJpc20gdGhlbWU6XG4gICAgICAgIHByaXNtQ29tbWVudDogJyM3MDgwOTAnLCAvLyBzbGF0ZWdyYXlcbiAgICAgICAgcHJpc21Qcm9sb2c6ICdwcmlzbUNvbW1lbnQnLFxuICAgICAgICBwcmlzbURvY3R5cGU6ICdwcmlzbUNvbW1lbnQnLFxuICAgICAgICBwcmlzbUNkYXRhOiAncHJpc21Db21tZW50JyxcblxuICAgICAgICBwcmlzbVB1bmN0dWF0aW9uOiAnIzk5OScsXG5cbiAgICAgICAgcHJpc21TeW1ib2w6ICcjOTA1JyxcbiAgICAgICAgcHJpc21Qcm9wZXJ0eTogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21UYWc6ICdwcmlzbVN5bWJvbCcsXG4gICAgICAgIHByaXNtQm9vbGVhbjogJ3ByaXNtU3ltYm9sJyxcbiAgICAgICAgcHJpc21OdW1iZXI6ICdwcmlzbVN5bWJvbCcsXG4gICAgICAgIHByaXNtQ29uc3RhbnQ6ICdwcmlzbVN5bWJvbCcsXG4gICAgICAgIHByaXNtRGVsZXRlZDogJ3ByaXNtU3ltYm9sJyxcblxuICAgICAgICBwcmlzbVN0cmluZzogJyM2OTAnLFxuICAgICAgICBwcmlzbVNlbGVjdG9yOiAncHJpc21TdHJpbmcnLFxuICAgICAgICBwcmlzbUF0dHJOYW1lOiAncHJpc21TdHJpbmcnLFxuICAgICAgICBwcmlzbUNoYXI6ICdwcmlzbVN0cmluZycsXG4gICAgICAgIHByaXNtQnVpbHRpbjogJ3ByaXNtU3RyaW5nJyxcbiAgICAgICAgcHJpc21JbnNlcnRlZDogJ3ByaXNtU3RyaW5nJyxcblxuICAgICAgICBwcmlzbU9wZXJhdG9yOiAnI2E2N2Y1OScsXG4gICAgICAgIHByaXNtVmFyaWFibGU6ICdwcmlzbU9wZXJhdG9yJyxcbiAgICAgICAgcHJpc21FbnRpdHk6ICdwcmlzbU9wZXJhdG9yJyxcbiAgICAgICAgcHJpc21Vcmw6ICdwcmlzbU9wZXJhdG9yJyxcbiAgICAgICAgcHJpc21Dc3NTdHJpbmc6ICdwcmlzbU9wZXJhdG9yJyxcblxuICAgICAgICBwcmlzbUtleXdvcmQ6ICcjMDdhJyxcbiAgICAgICAgcHJpc21BdHJ1bGU6ICdwcmlzbUtleXdvcmQnLFxuICAgICAgICBwcmlzbUF0dHJWYWx1ZTogJ3ByaXNtS2V5d29yZCcsXG5cbiAgICAgICAgcHJpc21GdW5jdGlvbjogJyNERDRBNjgnLFxuXG4gICAgICAgIHByaXNtUmVnZXg6ICcjZTkwJyxcbiAgICAgICAgcHJpc21JbXBvcnRhbnQ6IFsnI2U5MCcsICdib2xkJ11cbiAgICB9LFxuICAgIGxhbmd1YWdlTWFwcGluZyA9IHtcbiAgICAgICAgJ3RleHQvaHRtbCc6ICdtYXJrdXAnLFxuICAgICAgICAnYXBwbGljYXRpb24veG1sJzogJ21hcmt1cCcsXG4gICAgICAgICd0ZXh0L3htbCc6ICdtYXJrdXAnLFxuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdqYXZhc2NyaXB0JyxcbiAgICAgICAgJ3RleHQvamF2YXNjcmlwdCc6ICdqYXZhc2NyaXB0JyxcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnOiAnamF2YXNjcmlwdCcsXG4gICAgICAgICd0ZXh0L2Nzcyc6ICdjc3MnLFxuICAgICAgICBodG1sOiAnbWFya3VwJyxcbiAgICAgICAgeG1sOiAnbWFya3VwJyxcbiAgICAgICAgYzogJ2NsaWtlJyxcbiAgICAgICAgJ2MrKyc6ICdjbGlrZScsXG4gICAgICAgICdjcHAnOiAnY2xpa2UnLFxuICAgICAgICAnYyMnOiAnY2xpa2UnLFxuICAgICAgICBqYXZhOiAnY2xpa2UnXG4gICAgfTtcblxuZnVuY3Rpb24gdXBwZXJDYW1lbENhc2Uoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC8oPzpefC0pKFthLXpdKS9nLCBmdW5jdGlvbiAoJDAsIGNoKSB7XG4gICAgICAgIHJldHVybiBjaC50b1VwcGVyQ2FzZSgpO1xuICAgIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBuYW1lOiAnbWFnaWNwZW4tcHJpc20nLFxuICAgIGluc3RhbGxJbnRvOiBmdW5jdGlvbiAobWFnaWNQZW4pIHtcbiAgICAgICAgbWFnaWNQZW4uaW5zdGFsbFRoZW1lKGRlZmF1bHRUaGVtZSk7XG5cbiAgICAgICAgbWFnaWNQZW4uYWRkU3R5bGUoJ2NvZGUnLCBmdW5jdGlvbiAoc291cmNlVGV4dCwgbGFuZ3VhZ2UpIHtcbiAgICAgICAgICAgIGlmIChsYW5ndWFnZSBpbiBsYW5ndWFnZU1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZSA9IGxhbmd1YWdlTWFwcGluZ1tsYW5ndWFnZV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9cXCt4bWxcXGIvLnRlc3QobGFuZ3VhZ2UpKSB7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2UgPSAnbWFya3VwJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGxhbmd1YWdlIGluIHByaXNtLmxhbmd1YWdlcykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50ZXh0KHNvdXJjZVRleHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzb3VyY2VUZXh0ID0gc291cmNlVGV4dC5yZXBsYWNlKC88L2csICcmbHQ7Jyk7IC8vIFByaXNtaXNtXG5cbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcyxcbiAgICAgICAgICAgICAgICBjYXBpdGFsaXplZExhbmd1YWdlID0gdXBwZXJDYW1lbENhc2UobGFuZ3VhZ2UpO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBwcmludFRva2Vucyh0b2tlbiwgcGFyZW50U3R5bGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0b2tlbikpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4uZm9yRWFjaChmdW5jdGlvbiAoc3ViVG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW50VG9rZW5zKHN1YlRva2VuLCBwYXJlbnRTdHlsZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGUgPSB1cHBlckNhbWVsQ2FzZShwYXJlbnRTdHlsZSk7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuID0gdG9rZW4ucmVwbGFjZSgvJmx0Oy9nLCAnPCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdFsncHJpc20nICsgY2FwaXRhbGl6ZWRMYW5ndWFnZSArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdFsncHJpc20nICsgY2FwaXRhbGl6ZWRMYW5ndWFnZSArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSh0b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhhdFsncHJpc20nICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0WydwcmlzbScgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0odG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50ZXh0KHRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByaW50VG9rZW5zKHRva2VuLmNvbnRlbnQsIHRva2VuLnR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByaW50VG9rZW5zKHByaXNtLnRva2VuaXplKHNvdXJjZVRleHQsIHByaXNtLmxhbmd1YWdlc1tsYW5ndWFnZV0pLCAndGV4dCcpO1xuICAgICAgICB9LCB0cnVlKTtcbiAgICB9XG59O1xuIl19
