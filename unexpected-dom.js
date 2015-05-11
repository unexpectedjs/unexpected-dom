(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var arrayChanges = require('array-changes');

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

    styles[tuple[0]] = tuple[1];
  });

  return styles;
}

function getClassNamesFromAttributeValue(attributeValue) {
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
    expect.output.installPlugin(require('magicpen-prism'));
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
      delimiter: function (output) {
        return output.text('delimiter');
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
          output.append(inspect(document.childNodes[i], depth - 1));
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

        output.code(startTag, 'html');
        if (element.childNodes.length > 0) {

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

    expect.addAssertion('DOMTextNode', 'to satisfy', function (expect, subject, value) {
      return expect(subject.nodeValue, 'to satisfy', value);
    });

    expect.addAssertion('DOMElement', 'to satisfy', function (expect, subject, value) {
      var isHtml = subject.ownerDocument.contentType === 'text/html';
      if (value && typeof value === 'object') {
        var unsupportedOptions = Object.keys(value).filter(function (key) {
          return key !== 'attributes' && key !== 'name' && key !== 'children' && key !== 'onlyAttributes';
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
            return topLevelExpect(subject.childNodes, 'to satisfy', value.children);
          }
        }),
        attributes: {}
      };

      var onlyAttributes = value && value.onlyAttributes;
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
              expect(subject.hasAttribute(attributeName), 'to be true');
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
                      .error((nameError && nameError.label) || 'should satisfy') // v8: err.getLabel()
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
                        if (promise) {
                          this.append(promise.reason().output); // v8: getErrorMessage
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
                                .error((err && err.label) || 'should satisfy') // v8: err.getLabel()
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
                var childrenDiff = childrenError && childrenError.createDiff && childrenError.createDiff(output.clone(), diff, inspect, equal);
                if (childrenError) {
                  output
                    .nl()
                    .indentLines()
                    .i().block(function () {
                      for (var i = 0 ; i < subject.childNodes.length ; i += 1) {
                        this.append(inspect(subject.childNodes[i])).nl();
                      }
                    });
                  if (childrenError) {
                    output.sp().annotationBlock(function () { // v8: childrenError.getErrorMessage()
                      this.append(childrenError.output);
                      if (childrenDiff && childrenDiff.diff) {
                        this.nl(2).append(childrenDiff.diff);
                      }
                    });
                  }
                  output.nl();
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

    expect.addAssertion('string', 'when parsed as (html|HTML)', function (expect, subject) {
      this.errorMode = 'nested';
      var htmlDocument;
      if (typeof DOMParser !== 'undefined') {
        htmlDocument = new DOMParser().parseFromString(subject, 'text/html');
      } else if (typeof document !== 'undefined' && document.implementation && document.implementation.createHTMLDocument) {
        htmlDocument = document.implementation.createHTMLDocument('');
        htmlDocument.open();
        htmlDocument.write(subject);
        htmlDocument.close();
      } else {
        try {
          htmlDocument = require('jsdom').jsdom(subject);
        } catch (err) {
          throw new Error('The assertion `' + this.testDescription + '` was run outside a browser, but could not find the `jsdom` module. Please npm install jsdom to make this work.');
        }
      }
      return this.shift(expect, htmlDocument, 0);
    });

    expect.addAssertion('string', 'when parsed as (xml|XML)', function (expect, subject) {
      this.errorMode = 'nested';
      var xmlDocument;
      if (typeof DOMParser !== 'undefined') {
        xmlDocument = new DOMParser().parseFromString(subject, 'text/xml');
      } else {
        try {
          xmlDocument = require('jsdom').jsdom(subject, { parsingMode: 'xml' });
        } catch (err) {
          throw new Error('The assertion `' + this.testDescription + '` was outside a browser (or in a browser without DOMParser), but could not find the `jsdom` module. Please npm install jsdom to make this work.');
        }
      }
      return this.shift(expect, xmlDocument, 0);
    });
  }
};

},{"array-changes":2,"jsdom":"jsdom","magicpen-prism":5}],2:[function(require,module,exports){
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

    var itemsDiff = arrayDiff(actual, expected, function (a, b) {
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
        actual.forEach(function (_, index) {
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

},{"arraydiff":3}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){


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
},{}],5:[function(require,module,exports){
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

},{"../3rdparty/prism":4}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXJyYXktY2hhbmdlcy9saWIvYXJyYXlDaGFuZ2VzLmpzIiwibm9kZV9tb2R1bGVzL2FycmF5LWNoYW5nZXMvbm9kZV9tb2R1bGVzL2FycmF5ZGlmZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tYWdpY3Blbi1wcmlzbS8zcmRwYXJ0eS9wcmlzbS5qcyIsIm5vZGVfbW9kdWxlcy9tYWdpY3Blbi1wcmlzbS9saWIvbWFnaWNQZW5QcmlzbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2p2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGFycmF5Q2hhbmdlcyA9IHJlcXVpcmUoJ2FycmF5LWNoYW5nZXMnKTtcblxuLy8gRnJvbSBodG1sLW1pbmlmaWVyXG52YXIgZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlcyA9IHtcbiAgZHJhZ2dhYmxlOiBbJ3RydWUnLCAnZmFsc2UnXSAvLyBkZWZhdWx0cyB0byAnYXV0bydcbn07XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKSB7XG4gIHZhciBpc1NpbXBsZUJvb2xlYW4gPSAoL14oPzphbGxvd2Z1bGxzY3JlZW58YXN5bmN8YXV0b2ZvY3VzfGF1dG9wbGF5fGNoZWNrZWR8Y29tcGFjdHxjb250cm9sc3xkZWNsYXJlfGRlZmF1bHR8ZGVmYXVsdGNoZWNrZWR8ZGVmYXVsdG11dGVkfGRlZmF1bHRzZWxlY3RlZHxkZWZlcnxkaXNhYmxlZHxlbmFibGVkfGZvcm1ub3ZhbGlkYXRlfGhpZGRlbnxpbmRldGVybWluYXRlfGluZXJ0fGlzbWFwfGl0ZW1zY29wZXxsb29wfG11bHRpcGxlfG11dGVkfG5vaHJlZnxub3Jlc2l6ZXxub3NoYWRlfG5vdmFsaWRhdGV8bm93cmFwfG9wZW58cGF1c2VvbmV4aXR8cmVhZG9ubHl8cmVxdWlyZWR8cmV2ZXJzZWR8c2NvcGVkfHNlYW1sZXNzfHNlbGVjdGVkfHNvcnRhYmxlfHNwZWxsY2hlY2t8dHJ1ZXNwZWVkfHR5cGVtdXN0bWF0Y2h8dmlzaWJsZSkkL2kpLnRlc3QoYXR0ck5hbWUpO1xuICBpZiAoaXNTaW1wbGVCb29sZWFuKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgYXR0clZhbHVlRW51bWVyYXRpb24gPSBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzW2F0dHJOYW1lLnRvTG93ZXJDYXNlKCldO1xuICBpZiAoIWF0dHJWYWx1ZUVudW1lcmF0aW9uKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGVsc2Uge1xuICAgIHJldHVybiAoLTEgPT09IGF0dHJWYWx1ZUVudW1lcmF0aW9uLmluZGV4T2YoYXR0clZhbHVlLnRvTG93ZXJDYXNlKCkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHlsZVN0cmluZ1RvT2JqZWN0KHN0cikge1xuICB2YXIgc3R5bGVzID0ge307XG5cbiAgc3RyLnNwbGl0KCc7JykuZm9yRWFjaChmdW5jdGlvbiAocnVsZSkge1xuICAgIHZhciB0dXBsZSA9IHJ1bGUuc3BsaXQoJzonKS5tYXAoZnVuY3Rpb24gKHBhcnQpIHsgcmV0dXJuIHBhcnQudHJpbSgpOyB9KTtcblxuICAgIHN0eWxlc1t0dXBsZVswXV0gPSB0dXBsZVsxXTtcbiAgfSk7XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSkge1xuICB2YXIgY2xhc3NOYW1lcyA9IGF0dHJpYnV0ZVZhbHVlLnNwbGl0KC9cXHMrLyk7XG4gIGlmIChjbGFzc05hbWVzLmxlbmd0aCA9PT0gMSAmJiBjbGFzc05hbWVzWzBdID09PSAnJykge1xuICAgIGNsYXNzTmFtZXMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIGNsYXNzTmFtZXM7XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZXMoZWxlbWVudCkge1xuICB2YXIgaXNIdG1sID0gZWxlbWVudC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgdmFyIGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChhdHRyc1tpXS5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBhdHRyc1tpXS52YWx1ZSAmJiBhdHRyc1tpXS52YWx1ZS5zcGxpdCgnICcpIHx8IFtdO1xuICAgIH0gZWxzZSBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gc3R5bGVTdHJpbmdUb09iamVjdChhdHRyc1tpXS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IGlzSHRtbCAmJiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cnNbaV0ubmFtZSkgPyB0cnVlIDogKGF0dHJzW2ldLnZhbHVlIHx8ICcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBlbnRpdGlmeSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpIHtcbiAgcmV0dXJuICgvKD86YXJlYXxiYXNlfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKS9pKS50ZXN0KGVsZW1lbnROYW1lKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgdmFsdWUsIGlzSHRtbCkge1xuICBvdXRwdXQucHJpc21BdHRyTmFtZShhdHRyaWJ1dGVOYW1lKTtcbiAgaWYgKCFpc0h0bWwgfHwgIWlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKSkge1xuICAgIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLmpvaW4oJyAnKTtcbiAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZU5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgIHZhbHVlID0gT2JqZWN0LmtleXModmFsdWUpLm1hcChmdW5jdGlvbiAoY3NzUHJvcCkge1xuICAgICAgICByZXR1cm4gY3NzUHJvcCArICc6ICcgKyB2YWx1ZVtjc3NQcm9wXTtcbiAgICAgIH0pLmpvaW4oJzsgJyk7XG4gICAgfVxuICAgIG91dHB1dFxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJz1cIicpXG4gICAgICAucHJpc21BdHRyVmFsdWUoZW50aXRpZnkodmFsdWUpKVxuICAgICAgLnByaXNtUHVuY3R1YXRpb24oJ1wiJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZTtcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSB7XG4gICAgcmV0dXJuICdjbGFzcz1cIicgKyB2YWx1ZS5qb2luKCcgJykgKyAnXCInOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgfSBlbHNlIGlmIChhdHRyaWJ1dGVOYW1lID09PSAnc3R5bGUnKSB7XG4gICAgcmV0dXJuICdzdHlsZT1cIicgKyBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKGZ1bmN0aW9uIChjc3NQcm9wKSB7XG4gICAgICByZXR1cm4gW2Nzc1Byb3AsIHZhbHVlW2Nzc1Byb3BdXS5qb2luKCc6ICcpOyAvLyBGSVhNRTogZW50aXRpZnlcbiAgICB9KS5qb2luKCc7ICcpICsgJ1wiJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cmlidXRlTmFtZSArICc9XCInICsgZW50aXRpZnkodmFsdWUpICsgJ1wiJztcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCcgPyBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtZW50Lm5vZGVOYW1lO1xuICB2YXIgc3RyID0gJzwnICsgZWxlbWVudE5hbWU7XG4gIHZhciBhdHRycyA9IGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCk7XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHN0ciArPSAnICcgKyBzdHJpbmdpZnlBdHRyaWJ1dGUoa2V5LCBhdHRyc1trZXldKTtcbiAgfSk7XG5cbiAgc3RyICs9ICc+JztcbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpIHtcbiAgdmFyIGlzSHRtbCA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5jb250ZW50VHlwZSA9PT0gJ3RleHQvaHRtbCc7XG4gIHZhciBlbGVtZW50TmFtZSA9IGlzSHRtbCA/IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IGVsZW1lbnQubm9kZU5hbWU7XG4gIGlmIChpc0h0bWwgJiYgaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkgJiYgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJzwvJyArIGVsZW1lbnROYW1lICsgJz4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRpZmZOb2RlTGlzdHMoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICB2YXIgY2hhbmdlcyA9IGFycmF5Q2hhbmdlcyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhY3R1YWwpLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChleHBlY3RlZCksIGVxdWFsLCBmdW5jdGlvbiAoYSwgYikge1xuICAgIC8vIEZpZ3VyZSBvdXQgd2hldGhlciBhIGFuZCBiIGFyZSBcInN0cnV0dXJhbGx5IHNpbWlsYXJcIiBzbyB0aGV5IGNhbiBiZSBkaWZmZWQgaW5saW5lLlxuICAgIHJldHVybiAoXG4gICAgICBhLm5vZGVUeXBlID09PSAxICYmIGIubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgIGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWVcbiAgICApO1xuICB9KTtcblxuICBjaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtLCBpbmRleCkge1xuICAgIG91dHB1dC5pKCkuYmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHR5cGUgPSBkaWZmSXRlbS50eXBlO1xuICAgICAgaWYgKHR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgIHRoaXMuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdtaXNzaW5nICcpLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkuc3AoKS5lcnJvcignLy8gc2hvdWxkIGJlIHJlbW92ZWQnKSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdlcXVhbCcpIHtcbiAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgdmFsdWVEaWZmID0gZGlmZihkaWZmSXRlbS52YWx1ZSwgZGlmZkl0ZW0uZXhwZWN0ZWQpO1xuICAgICAgICBpZiAodmFsdWVEaWZmICYmIHZhbHVlRGlmZi5pbmxpbmUpIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKHZhbHVlRGlmZi5kaWZmKTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZURpZmYpIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNob3VsZEVxdWFsRXJyb3IoZGlmZkl0ZW0uZXhwZWN0ZWQsIGluc3BlY3QpLm5sKCkuYXBwZW5kKHZhbHVlRGlmZi5kaWZmKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNob3VsZEVxdWFsRXJyb3IoZGlmZkl0ZW0uZXhwZWN0ZWQsIGluc3BlY3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkubmwoaW5kZXggPCBjaGFuZ2VzLmxlbmd0aCAtIDEgPyAxIDogMCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbmFtZTogJ3VuZXhwZWN0ZWQtZG9tJyxcbiAgaW5zdGFsbEludG86IGZ1bmN0aW9uIChleHBlY3QpIHtcbiAgICBleHBlY3Qub3V0cHV0Lmluc3RhbGxQbHVnaW4ocmVxdWlyZSgnbWFnaWNwZW4tcHJpc20nKSk7XG4gICAgdmFyIHRvcExldmVsRXhwZWN0ID0gZXhwZWN0O1xuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlJyxcbiAgICAgIGJhc2U6ICdvYmplY3QnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZU5hbWUgJiYgWzIsIDMsIDQsIDUsIDYsIDcsIDEwLCAxMSwgMTJdLmluZGV4T2Yob2JqLm5vZGVUeXBlKSA+IC0xO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUgPT09IGIubm9kZVZhbHVlO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChlbGVtZW50LCBkZXB0aCwgb3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZShlbGVtZW50Lm5vZGVOYW1lICsgJyBcIicgKyBlbGVtZW50Lm5vZGVWYWx1ZSArICdcIicsICdwcmlzbS1zdHJpbmcnKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Db21tZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSA4O1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUgPT09IGIubm9kZVZhbHVlO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChlbGVtZW50LCBkZXB0aCwgb3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZSgnPCEtLScgKyBlbGVtZW50Lm5vZGVWYWx1ZSArICctLT4nLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZignPCEtLScgKyBhY3R1YWwubm9kZVZhbHVlICsgJy0tPicsICc8IS0tJyArIGV4cGVjdGVkLm5vZGVWYWx1ZSArICctLT4nKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01UZXh0Tm9kZScsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgPT09ICdudW1iZXInICYmIG9iai5ub2RlVHlwZSA9PT0gMztcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlLnRyaW0oKSA9PT0gYi5ub2RlVmFsdWUudHJpbSgpO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChlbGVtZW50LCBkZXB0aCwgb3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQuY29kZShlbnRpdGlmeShlbGVtZW50Lm5vZGVWYWx1ZS50cmltKCkpLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciBkID0gZGlmZihhY3R1YWwubm9kZVZhbHVlLCBleHBlY3RlZC5ub2RlVmFsdWUpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGVMaXN0JyxcbiAgICAgIGJhc2U6ICdhcnJheS1saWtlJyxcbiAgICAgIHByZWZpeDogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ05vZGVMaXN0WycpO1xuICAgICAgfSxcbiAgICAgIHN1ZmZpeDogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ10nKTtcbiAgICAgIH0sXG4gICAgICBkZWxpbWl0ZXI6IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCdkZWxpbWl0ZXInKTtcbiAgICAgIH0sXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG9iaiAmJlxuICAgICAgICAgIHR5cGVvZiBvYmoubGVuZ3RoID09PSAnbnVtYmVyJyAmJlxuICAgICAgICAgIHR5cGVvZiBvYmoudG9TdHJpbmcgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLml0ZW0gPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICBvYmoudG9TdHJpbmcoKS5pbmRleE9mKCdOb2RlTGlzdCcpICE9PSAtMVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2NUeXBlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAxMCAmJiAncHVibGljSWQnIGluIG9iajtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdHlwZSwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICBvdXRwdXQuY29kZSgnPCFET0NUWVBFICcgKyBkb2N0eXBlLm5hbWUgKyAnPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLnRvU3RyaW5nKCkgPT09IGIudG9TdHJpbmcoKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmKSB7XG4gICAgICAgIHZhciBkID0gZGlmZignPCFET0NUWVBFICcgKyBhY3R1YWwubmFtZSArICc+JywgJzwhRE9DVFlQRSAnICsgZXhwZWN0ZWQubmFtZSArICc+Jyk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiBvYmoubm9kZVR5cGUgPT09IDkgJiYgb2JqLmRvY3VtZW50RWxlbWVudCAmJiBvYmouaW1wbGVtZW50YXRpb247XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0KGRvY3VtZW50LmNoaWxkTm9kZXNbaV0sIGRlcHRoIC0gMSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NRG9jdW1lbnQnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmFzZVR5cGUuaWRlbnRpZnkob2JqKSAmJiBvYmouY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ1hNTERvY3VtZW50JyxcbiAgICAgIGJhc2U6ICdET01Eb2N1bWVudCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5iYXNlVHlwZS5pZGVudGlmeShvYmopICYmIC9eKD86YXBwbGljYXRpb258dGV4dClcXC94bWx8XFwreG1sXFxiLy50ZXN0KG9iai5jb250ZW50VHlwZSk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8P3htbCB2ZXJzaW9uPVwiMS4wXCI/PicsICd4bWwnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSwgZGVwdGggLSAxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01FbGVtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgb2JqLm5vZGVUeXBlID09PSAxICYmIG9iai5ub2RlTmFtZSAmJiBvYmouYXR0cmlidXRlcztcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIsIGVxdWFsKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGIubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAmJiBlcXVhbChnZXRBdHRyaWJ1dGVzKGEpLCBnZXRBdHRyaWJ1dGVzKGIpKSAmJiBlcXVhbChhLmNoaWxkTm9kZXMsIGIuY2hpbGROb2Rlcyk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgdmFyIGVsZW1lbnROYW1lID0gZWxlbWVudC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgc3RhcnRUYWcgPSBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KTtcblxuICAgICAgICB2YXIgaW5zcGVjdGVkQ2hpbGRyZW4gPSBbXTtcbiAgICAgICAgaWYgKGVsZW1lbnROYW1lID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgIHZhciB0eXBlID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKTtcbiAgICAgICAgICBpZiAoIXR5cGUgfHwgL2phdmFzY3JpcHQvLnRlc3QodHlwZSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnamF2YXNjcmlwdCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCB0eXBlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKG91dHB1dC5jbG9uZSgpLmNvZGUoZWxlbWVudC50ZXh0Q29udGVudCwgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKSB8fCAndGV4dC9jc3MnKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChpbnNwZWN0KGVsZW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3aWR0aCA9IDA7XG4gICAgICAgIHZhciBtdWx0aXBsZUxpbmVzID0gaW5zcGVjdGVkQ2hpbGRyZW4uc29tZShmdW5jdGlvbiAobykge1xuICAgICAgICAgIHZhciBzaXplID0gby5zaXplKCk7XG4gICAgICAgICAgd2lkdGggKz0gc2l6ZS53aWR0aDtcbiAgICAgICAgICByZXR1cm4gd2lkdGggPiA1MCB8fCBvLmhlaWdodCA+IDE7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0YXJ0VGFnLCAnaHRtbCcpO1xuICAgICAgICBpZiAoZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgIGlmIChtdWx0aXBsZUxpbmVzKSB7XG4gICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuXG4gICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmkoKS5ibG9jayhpbnNwZWN0ZWRDaGlsZCkubmwoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBvdXRwdXQub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3RlZENoaWxkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoZWxlbWVudCksICdodG1sJyk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgZGlmZkxpbWl0OiA1MTIsXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgaXNIdG1sID0gYWN0dWFsLm93bmVyRG9jdW1lbnQuY29udGVudFR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuICAgICAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgICAgIGRpZmY6IG91dHB1dCxcbiAgICAgICAgICBpbmxpbmU6IHRydWVcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKSA+IHRoaXMuZGlmZkxpbWl0KSB7XG4gICAgICAgICAgcmVzdWx0LmRpZmYuanNDb21tZW50KCdEaWZmIHN1cHByZXNzZWQgZHVlIHRvIHNpemUgPiAnICsgdGhpcy5kaWZmTGltaXQpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZW1wdHlFbGVtZW50cyA9IGFjdHVhbC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCAmJiBleHBlY3RlZC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgdmFyIGNvbmZsaWN0aW5nRWxlbWVudCA9IGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIHx8ICFlcXVhbChnZXRBdHRyaWJ1dGVzKGFjdHVhbCksIGdldEF0dHJpYnV0ZXMoZXhwZWN0ZWQpKTtcblxuICAgICAgICBpZiAoY29uZmxpY3RpbmdFbGVtZW50KSB7XG4gICAgICAgICAgdmFyIGNhbkNvbnRpbnVlTGluZSA9IHRydWU7XG4gICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAucHJpc21QdW5jdHVhdGlvbignPCcpXG4gICAgICAgICAgICAucHJpc21UYWcoYWN0dWFsLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgIGlmIChhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAhPT0gZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgb3V0cHV0LnNwKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlJykuc3AoKS5wcmlzbVRhZyhleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGFjdHVhbEF0dHJpYnV0ZXMgPSBnZXRBdHRyaWJ1dGVzKGFjdHVhbCk7XG4gICAgICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlcyA9IGdldEF0dHJpYnV0ZXMoZXhwZWN0ZWQpO1xuICAgICAgICAgIE9iamVjdC5rZXlzKGFjdHVhbEF0dHJpYnV0ZXMpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgIG91dHB1dC5zcChjYW5Db250aW51ZUxpbmUgPyAxIDogMiArIGFjdHVhbC5ub2RlTmFtZS5sZW5ndGgpO1xuICAgICAgICAgICAgd3JpdGVBdHRyaWJ1dGVUb01hZ2ljUGVuKG91dHB1dCwgYXR0cmlidXRlTmFtZSwgYWN0dWFsQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSwgaXNIdG1sKTtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVOYW1lIGluIGV4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICBpZiAoYWN0dWFsQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9PT0gZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdKSB7XG4gICAgICAgICAgICAgICAgY2FuQ29udGludWVMaW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGVxdWFsJykuc3AoKS5hcHBlbmQoaW5zcGVjdChlbnRpdGlmeShleHBlY3RlZEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0pKSk7XG4gICAgICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb3V0cHV0LnNwKCkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdzaG91bGQgYmUgcmVtb3ZlZCcpO1xuICAgICAgICAgICAgICB9KS5ubCgpO1xuICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhleHBlY3RlZEF0dHJpYnV0ZXMpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgIG91dHB1dC5zcChjYW5Db250aW51ZUxpbmUgPyAxIDogMiArIGFjdHVhbC5ub2RlTmFtZS5sZW5ndGgpO1xuICAgICAgICAgICAgb3V0cHV0LmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHRoaXMuZXJyb3IoJ21pc3NpbmcnKS5zcCgpO1xuICAgICAgICAgICAgICB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4odGhpcywgYXR0cmlidXRlTmFtZSwgZXhwZWN0ZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLCBpc0h0bWwpO1xuICAgICAgICAgICAgfSkubmwoKTtcbiAgICAgICAgICAgIGNhbkNvbnRpbnVlTGluZSA9IGZhbHNlO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIG91dHB1dC5wcmlzbVB1bmN0dWF0aW9uKCc+Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5U3RhcnRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW1wdHlFbGVtZW50cykge1xuICAgICAgICAgIG91dHB1dC5ubCgpLmluZGVudExpbmVzKCk7XG4gICAgICAgICAgZGlmZk5vZGVMaXN0cyhhY3R1YWwuY2hpbGROb2RlcywgZXhwZWN0ZWQuY2hpbGROb2Rlcywgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCk7XG4gICAgICAgICAgb3V0cHV0Lm5sKCkub3V0ZGVudExpbmVzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTUVsZW1lbnQnLCAndG8gW29ubHldIGhhdmUgKGNsYXNzfGNsYXNzZXMpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBmbGFncyA9IHRoaXMuZmxhZ3M7XG4gICAgICBpZiAoZmxhZ3Mub25seSkge1xuICAgICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QsICd0byBoYXZlIGF0dHJpYnV0ZXMnLCB7XG4gICAgICAgICAgY2xhc3M6IGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgICAgIHZhciBhY3R1YWxDbGFzc2VzID0gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmbGFncy5vbmx5KSB7XG4gICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChhY3R1YWxDbGFzc2VzLnNvcnQoKSwgJ3RvIGVxdWFsJywgdmFsdWUuc29ydCgpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdC5hcHBseSh0b3BMZXZlbEV4cGVjdCwgW2FjdHVhbENsYXNzZXMsICd0byBjb250YWluJ10uY29uY2F0KHZhbHVlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdCwgJ3RvIGhhdmUgYXR0cmlidXRlcycsIHsgY2xhc3M6IHZhbHVlIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignRE9NVGV4dE5vZGUnLCAndG8gc2F0aXNmeScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3Qubm9kZVZhbHVlLCAndG8gc2F0aXNmeScsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTUVsZW1lbnQnLCAndG8gc2F0aXNmeScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgaXNIdG1sID0gc3ViamVjdC5vd25lckRvY3VtZW50LmNvbnRlbnRUeXBlID09PSAndGV4dC9odG1sJztcbiAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHZhciB1bnN1cHBvcnRlZE9wdGlvbnMgPSBPYmplY3Qua2V5cyh2YWx1ZSkuZmlsdGVyKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm4ga2V5ICE9PSAnYXR0cmlidXRlcycgJiYga2V5ICE9PSAnbmFtZScgJiYga2V5ICE9PSAnY2hpbGRyZW4nICYmIGtleSAhPT0gJ29ubHlBdHRyaWJ1dGVzJztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh1bnN1cHBvcnRlZE9wdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgb3B0aW9uJyArICh1bnN1cHBvcnRlZE9wdGlvbnMubGVuZ3RoID09PSAxID8gJycgOiAncycpICsgJzogJyArIHVuc3VwcG9ydGVkT3B0aW9ucy5qb2luKCcsICcpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgcHJvbWlzZUJ5S2V5ID0ge1xuICAgICAgICBuYW1lOiBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZS5uYW1lICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWUsICd0byBzYXRpc2Z5JywgdmFsdWUubmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgY2hpbGRyZW46IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlLmNoaWxkcmVuICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KHN1YmplY3QuY2hpbGROb2RlcywgJ3RvIHNhdGlzZnknLCB2YWx1ZS5jaGlsZHJlbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgYXR0cmlidXRlczoge31cbiAgICAgIH07XG5cbiAgICAgIHZhciBvbmx5QXR0cmlidXRlcyA9IHZhbHVlICYmIHZhbHVlLm9ubHlBdHRyaWJ1dGVzO1xuICAgICAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhzdWJqZWN0KTtcbiAgICAgIHZhciBleHBlY3RlZEF0dHJpYnV0ZXMgPSB2YWx1ZSAmJiB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgdmFyIGV4cGVjdGVkQXR0cmlidXRlTmFtZXMgPSBbXTtcblxuICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRBdHRyaWJ1dGVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGV4cGVjdGVkQXR0cmlidXRlcyA9IFtleHBlY3RlZEF0dHJpYnV0ZXNdO1xuICAgICAgICB9XG4gICAgICAgIHZhciBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lID0ge307XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZVthdHRyaWJ1dGVOYW1lXSA9IHRydWU7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRBdHRyaWJ1dGVzICYmIHR5cGVvZiBleHBlY3RlZEF0dHJpYnV0ZXMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgZXhwZWN0ZWRWYWx1ZUJ5QXR0cmlidXRlTmFtZSA9IGV4cGVjdGVkQXR0cmlidXRlcztcbiAgICAgICAgfVxuICAgICAgICBPYmplY3Qua2V5cyhleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lKS5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5wdXNoKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICB2YXIgYXR0cmlidXRlVmFsdWUgPSBzdWJqZWN0LmdldEF0dHJpYnV0ZShhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9IGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0gPSBleHBlY3QucHJvbWlzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlTmFtZSA9PT0gJ2NsYXNzJyAmJiAodHlwZW9mIGV4cGVjdGVkQXR0cmlidXRlVmFsdWUgPT09ICdzdHJpbmcnIHx8IEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSkpKSB7XG4gICAgICAgICAgICAgIHZhciBhY3R1YWxDbGFzc2VzID0gZ2V0Q2xhc3NOYW1lc0Zyb21BdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICAgIHZhciBleHBlY3RlZENsYXNzZXMgPSBleHBlY3RlZEF0dHJpYnV0ZVZhbHVlO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkQ2xhc3NlcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZENsYXNzZXMgPSBnZXRDbGFzc05hbWVzRnJvbUF0dHJpYnV0ZVZhbHVlKGV4cGVjdGVkQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChvbmx5QXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b3BMZXZlbEV4cGVjdChhY3R1YWxDbGFzc2VzLnNvcnQoKSwgJ3RvIGVxdWFsJywgZXhwZWN0ZWRDbGFzc2VzLnNvcnQoKSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0LmFwcGx5KHRvcExldmVsRXhwZWN0LCBbYWN0dWFsQ2xhc3NlcywgJ3RvIGNvbnRhaW4nXS5jb25jYXQoZXhwZWN0ZWRDbGFzc2VzKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlTmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICAgICAgICB2YXIgZXhwZWN0ZWRTdHlsZU9iajtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkU3R5bGVPYmogPSBzdHlsZVN0cmluZ1RvT2JqZWN0KGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWUuc3R5bGUpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkU3R5bGVPYmogPSBleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lLnN0eWxlO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRvcExldmVsRXhwZWN0KGF0dHJzLnN0eWxlLCAndG8gZXhoYXVzdGl2ZWx5IHNhdGlzZnknLCBleHBlY3RlZFN0eWxlT2JqKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYXR0cnMuc3R5bGUsICd0byBzYXRpc2Z5JywgZXhwZWN0ZWRTdHlsZU9iaik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICBleHBlY3Qoc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSksICd0byBiZSB0cnVlJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gdG9wTGV2ZWxFeHBlY3QoYXR0cmlidXRlVmFsdWUsICd0byBzYXRpc2Z5JywgZXhwZWN0ZWRBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHByb21pc2VCeUtleS5hdHRyaWJ1dGVQcmVzZW5jZSA9IGV4cGVjdC5wcm9taXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkID0gW107XG4gICAgICAgICAgZXhwZWN0ZWRBdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ25vdCB0byBoYXZlIGtleScsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkLnB1c2goYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICAgIGV4cGVjdChhdHRycywgJ3RvIGhhdmUga2V5JywgYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKG9ubHlBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBleHBlY3QoT2JqZWN0LmtleXMoYXR0cnMpLnNvcnQoKSwgJ3RvIGVxdWFsJywgYXR0cmlidXRlTmFtZXNFeHBlY3RlZFRvQmVEZWZpbmVkLnNvcnQoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV4cGVjdC5wcm9taXNlLmFsbChwcm9taXNlQnlLZXkpLmNhdWdodChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBleHBlY3QucHJvbWlzZS5zZXR0bGUocHJvbWlzZUJ5S2V5KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBleHBlY3QuZmFpbCh7XG4gICAgICAgICAgICBkaWZmOiBmdW5jdGlvbiAob3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICAgICAgICBvdXRwdXQuYmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBvdXRwdXQgPSB0aGlzO1xuICAgICAgICAgICAgICAgIG91dHB1dFxuICAgICAgICAgICAgICAgICAgLnByaXNtUHVuY3R1YXRpb24oJzwnKVxuICAgICAgICAgICAgICAgICAgLnByaXNtVGFnKGlzSHRtbCA/IHN1YmplY3Qubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA6IHN1YmplY3Qubm9kZU5hbWUpO1xuICAgICAgICAgICAgICAgIHZhciBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChwcm9taXNlQnlLZXkubmFtZS5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBuYW1lRXJyb3IgPSBwcm9taXNlQnlLZXkubmFtZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgIG91dHB1dC5zcCgpLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoKG5hbWVFcnJvciAmJiBuYW1lRXJyb3IubGFiZWwpIHx8ICdzaG91bGQgc2F0aXNmeScpIC8vIHY4OiBlcnIuZ2V0TGFiZWwoKVxuICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChpbnNwZWN0KHZhbHVlLm5hbWUpKTtcbiAgICAgICAgICAgICAgICAgIH0pLm5sKCk7XG4gICAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gcHJvbWlzZUJ5S2V5LmF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoY2FuQ29udGludWVMaW5lID8gMSA6IDIgKyBzdWJqZWN0Lm5vZGVOYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICB3cml0ZUF0dHJpYnV0ZVRvTWFnaWNQZW4ob3V0cHV0LCBhdHRyaWJ1dGVOYW1lLCBhdHRyc1thdHRyaWJ1dGVOYW1lXSwgaXNIdG1sKTtcbiAgICAgICAgICAgICAgICAgIGlmICgocHJvbWlzZSAmJiBwcm9taXNlLmlzRnVsZmlsbGVkKCkpIHx8ICghcHJvbWlzZSAmJiAoIW9ubHlBdHRyaWJ1dGVzIHx8IGV4cGVjdGVkQXR0cmlidXRlTmFtZXMuaW5kZXhPZihhdHRyaWJ1dGVOYW1lKSAhPT0gLTEpKSkge1xuICAgICAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgLnNwKClcbiAgICAgICAgICAgICAgICAgICAgICAuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKHByb21pc2UucmVhc29uKCkub3V0cHV0KTsgLy8gdjg6IGdldEVycm9yTWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seUF0dHJpYnV0ZXMgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcignc2hvdWxkIGJlIHJlbW92ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgIC5ubCgpO1xuICAgICAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBleHBlY3RlZEF0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghc3ViamVjdC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBwcm9taXNlQnlLZXkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwcm9taXNlIHx8IHByb21pc2UuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHByb21pc2UgJiYgcHJvbWlzZS5yZWFzb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC5ubCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3AoMiArIHN1YmplY3Qubm9kZU5hbWUubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZXJyb3IoJ21pc3NpbmcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByaXNtQXR0ck5hbWUoYXR0cmlidXRlTmFtZSwgJ2h0bWwnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV4cGVjdGVkVmFsdWVCeUF0dHJpYnV0ZU5hbWVbYXR0cmlidXRlTmFtZV0gIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lcnJvcigoZXJyICYmIGVyci5sYWJlbCkgfHwgJ3Nob3VsZCBzYXRpc2Z5JykgLy8gdjg6IGVyci5nZXRMYWJlbCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoaW5zcGVjdChleHBlY3RlZFZhbHVlQnlBdHRyaWJ1dGVOYW1lW2F0dHJpYnV0ZU5hbWVdKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAubmwoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYW5Db250aW51ZUxpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBvdXRwdXQucHJpc21QdW5jdHVhdGlvbignPicpO1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZHJlbkVycm9yID0gcHJvbWlzZUJ5S2V5LmNoaWxkcmVuLmlzUmVqZWN0ZWQoKSAmJiBwcm9taXNlQnlLZXkuY2hpbGRyZW4ucmVhc29uKCk7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuRGlmZiA9IGNoaWxkcmVuRXJyb3IgJiYgY2hpbGRyZW5FcnJvci5jcmVhdGVEaWZmICYmIGNoaWxkcmVuRXJyb3IuY3JlYXRlRGlmZihvdXRwdXQuY2xvbmUoKSwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgLm5sKClcbiAgICAgICAgICAgICAgICAgICAgLmluZGVudExpbmVzKClcbiAgICAgICAgICAgICAgICAgICAgLmkoKS5ibG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgc3ViamVjdC5jaGlsZE5vZGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoaW5zcGVjdChzdWJqZWN0LmNoaWxkTm9kZXNbaV0pKS5ubCgpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQuc3AoKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkgeyAvLyB2ODogY2hpbGRyZW5FcnJvci5nZXRFcnJvck1lc3NhZ2UoKVxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGNoaWxkcmVuRXJyb3Iub3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5EaWZmICYmIGNoaWxkcmVuRGlmZi5kaWZmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5sKDIpLmFwcGVuZChjaGlsZHJlbkRpZmYuZGlmZik7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIG91dHB1dC5ubCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBzdWJqZWN0LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kKGluc3BlY3Qoc3ViamVjdC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhzdWJqZWN0KSwgJ2h0bWwnKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRpZmY6IG91dHB1dFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignRE9NRWxlbWVudCcsICd0byBbb25seV0gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMykge1xuICAgICAgICAgIHZhbHVlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RvIGhhdmUgYXR0cmlidXRlczogQXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZywgYW4gYXJyYXksIG9yIGFuIG9iamVjdCcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cGVjdChzdWJqZWN0LCAndG8gc2F0aXNmeScsIHsgYXR0cmlidXRlczogdmFsdWUsIG9ubHlBdHRyaWJ1dGVzOiB0aGlzLmZsYWdzLm9ubHkgfSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdET01FbGVtZW50JywgJ3RvIGhhdmUgW25vXSAoY2hpbGR8Y2hpbGRyZW4pJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgcXVlcnksIGNtcCkge1xuICAgICAgaWYgKHRoaXMuZmxhZ3Mubm8pIHtcbiAgICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgcmV0dXJuIGV4cGVjdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdWJqZWN0LmNoaWxkTm9kZXMpLCAndG8gYmUgYW4gZW1wdHkgYXJyYXknKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHN1YmplY3QucXVlcnlTZWxlY3RvckFsbChxdWVyeSkpO1xuICAgICAgICB0aHJvdyBjaGlsZHJlbjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0RPTUVsZW1lbnQnLCAndG8gaGF2ZSB0ZXh0JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC50ZXh0Q29udGVudCwgJ3RvIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKFsnRE9NRG9jdW1lbnQnLCAnRE9NRWxlbWVudCddLCAncXVlcmllZCBmb3IgW2ZpcnN0XScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgcXVlcnlSZXN1bHQ7XG5cbiAgICAgIHRoaXMuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG5cbiAgICAgIGlmICh0aGlzLmZsYWdzLmZpcnN0KSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHZhbHVlKTtcbiAgICAgICAgaWYgKCFxdWVyeVJlc3VsdCkge1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyh2YWx1ZSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHZhbHVlKTtcbiAgICAgICAgaWYgKHF1ZXJ5UmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyh2YWx1ZSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnNoaWZ0KGV4cGVjdCwgcXVlcnlSZXN1bHQsIDEpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignc3RyaW5nJywgJ3doZW4gcGFyc2VkIGFzIChodG1sfEhUTUwpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgIHZhciBodG1sRG9jdW1lbnQ7XG4gICAgICBpZiAodHlwZW9mIERPTVBhcnNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaHRtbERvY3VtZW50ID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhzdWJqZWN0LCAndGV4dC9odG1sJyk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24gJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KSB7XG4gICAgICAgIGh0bWxEb2N1bWVudCA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCgnJyk7XG4gICAgICAgIGh0bWxEb2N1bWVudC5vcGVuKCk7XG4gICAgICAgIGh0bWxEb2N1bWVudC53cml0ZShzdWJqZWN0KTtcbiAgICAgICAgaHRtbERvY3VtZW50LmNsb3NlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGh0bWxEb2N1bWVudCA9IHJlcXVpcmUoJ2pzZG9tJykuanNkb20oc3ViamVjdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGFzc2VydGlvbiBgJyArIHRoaXMudGVzdERlc2NyaXB0aW9uICsgJ2Agd2FzIHJ1biBvdXRzaWRlIGEgYnJvd3NlciwgYnV0IGNvdWxkIG5vdCBmaW5kIHRoZSBganNkb21gIG1vZHVsZS4gUGxlYXNlIG5wbSBpbnN0YWxsIGpzZG9tIHRvIG1ha2UgdGhpcyB3b3JrLicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zaGlmdChleHBlY3QsIGh0bWxEb2N1bWVudCwgMCk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdzdHJpbmcnLCAnd2hlbiBwYXJzZWQgYXMgKHhtbHxYTUwpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgIHZhciB4bWxEb2N1bWVudDtcbiAgICAgIGlmICh0eXBlb2YgRE9NUGFyc2VyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB4bWxEb2N1bWVudCA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoc3ViamVjdCwgJ3RleHQveG1sJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHhtbERvY3VtZW50ID0gcmVxdWlyZSgnanNkb20nKS5qc2RvbShzdWJqZWN0LCB7IHBhcnNpbmdNb2RlOiAneG1sJyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYXNzZXJ0aW9uIGAnICsgdGhpcy50ZXN0RGVzY3JpcHRpb24gKyAnYCB3YXMgb3V0c2lkZSBhIGJyb3dzZXIgKG9yIGluIGEgYnJvd3NlciB3aXRob3V0IERPTVBhcnNlciksIGJ1dCBjb3VsZCBub3QgZmluZCB0aGUgYGpzZG9tYCBtb2R1bGUuIFBsZWFzZSBucG0gaW5zdGFsbCBqc2RvbSB0byBtYWtlIHRoaXMgd29yay4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc2hpZnQoZXhwZWN0LCB4bWxEb2N1bWVudCwgMCk7XG4gICAgfSk7XG4gIH1cbn07XG4iLCJ2YXIgYXJyYXlEaWZmID0gcmVxdWlyZSgnYXJyYXlkaWZmJyk7XG5cbmZ1bmN0aW9uIGV4dGVuZCh0YXJnZXQpIHtcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBPYmplY3Qua2V5cyhzb3VyY2UpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXJyYXlDaGFuZ2VzKGFjdHVhbCwgZXhwZWN0ZWQsIGVxdWFsLCBzaW1pbGFyKSB7XG4gICAgdmFyIG11dGF0ZWRBcnJheSA9IG5ldyBBcnJheShhY3R1YWwubGVuZ3RoKTtcblxuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgYWN0dWFsLmxlbmd0aDsgayArPSAxKSB7XG4gICAgICAgIG11dGF0ZWRBcnJheVtrXSA9IHtcbiAgICAgICAgICAgIHR5cGU6ICdzaW1pbGFyJyxcbiAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxba11cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAobXV0YXRlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgbXV0YXRlZEFycmF5W211dGF0ZWRBcnJheS5sZW5ndGggLSAxXS5sYXN0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBzaW1pbGFyID0gc2ltaWxhciB8fCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIHZhciBpdGVtc0RpZmYgPSBhcnJheURpZmYoYWN0dWFsLCBleHBlY3RlZCwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGVxdWFsKGEsIGIpIHx8IHNpbWlsYXIoYSwgYik7XG4gICAgfSk7XG5cbiAgICB2YXIgcmVtb3ZlVGFibGUgPSBbXTtcbiAgICBmdW5jdGlvbiBvZmZzZXRJbmRleChpbmRleCkge1xuICAgICAgICByZXR1cm4gaW5kZXggKyAocmVtb3ZlVGFibGVbaW5kZXggLSAxXSB8fCAwKTtcbiAgICB9XG5cbiAgICB2YXIgcmVtb3ZlcyA9IGl0ZW1zRGlmZi5maWx0ZXIoZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHJldHVybiBkaWZmSXRlbS50eXBlID09PSAncmVtb3ZlJztcbiAgICB9KTtcblxuICAgIHZhciByZW1vdmVzQnlJbmRleCA9IHt9O1xuICAgIHZhciByZW1vdmVkSXRlbXMgPSAwO1xuICAgIHJlbW92ZXMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgdmFyIHJlbW92ZUluZGV4ID0gcmVtb3ZlZEl0ZW1zICsgZGlmZkl0ZW0uaW5kZXg7XG4gICAgICAgIG11dGF0ZWRBcnJheS5zbGljZShyZW1vdmVJbmRleCwgZGlmZkl0ZW0uaG93TWFueSArIHJlbW92ZUluZGV4KS5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICB2LnR5cGUgPSAncmVtb3ZlJztcbiAgICAgICAgfSk7XG4gICAgICAgIHJlbW92ZWRJdGVtcyArPSBkaWZmSXRlbS5ob3dNYW55O1xuICAgICAgICByZW1vdmVzQnlJbmRleFtkaWZmSXRlbS5pbmRleF0gPSByZW1vdmVkSXRlbXM7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVSZW1vdmVUYWJsZSgpIHtcbiAgICAgICAgcmVtb3ZlZEl0ZW1zID0gMDtcbiAgICAgICAgYWN0dWFsLmZvckVhY2goZnVuY3Rpb24gKF8sIGluZGV4KSB7XG4gICAgICAgICAgICByZW1vdmVkSXRlbXMgKz0gcmVtb3Zlc0J5SW5kZXhbaW5kZXhdIHx8IDA7XG4gICAgICAgICAgICByZW1vdmVUYWJsZVtpbmRleF0gPSByZW1vdmVkSXRlbXM7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHVwZGF0ZVJlbW92ZVRhYmxlKCk7XG5cbiAgICB2YXIgbW92ZXMgPSBpdGVtc0RpZmYuZmlsdGVyKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICByZXR1cm4gZGlmZkl0ZW0udHlwZSA9PT0gJ21vdmUnO1xuICAgIH0pO1xuXG4gICAgdmFyIG1vdmVkSXRlbXMgPSAwO1xuICAgIG1vdmVzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHZhciBtb3ZlRnJvbUluZGV4ID0gb2Zmc2V0SW5kZXgoZGlmZkl0ZW0uZnJvbSk7XG4gICAgICAgIHZhciByZW1vdmVkID0gbXV0YXRlZEFycmF5LnNsaWNlKG1vdmVGcm9tSW5kZXgsIGRpZmZJdGVtLmhvd01hbnkgKyBtb3ZlRnJvbUluZGV4KTtcbiAgICAgICAgdmFyIGFkZGVkID0gcmVtb3ZlZC5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHJldHVybiBleHRlbmQoe30sIHYsIHsgbGFzdDogZmFsc2UsIHR5cGU6ICdpbnNlcnQnIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICB2LnR5cGUgPSAncmVtb3ZlJztcbiAgICAgICAgfSk7XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkobXV0YXRlZEFycmF5LCBbb2Zmc2V0SW5kZXgoZGlmZkl0ZW0udG8pLCAwXS5jb25jYXQoYWRkZWQpKTtcbiAgICAgICAgbW92ZWRJdGVtcyArPSBkaWZmSXRlbS5ob3dNYW55O1xuICAgICAgICByZW1vdmVzQnlJbmRleFtkaWZmSXRlbS5mcm9tXSA9IG1vdmVkSXRlbXM7XG4gICAgICAgIHVwZGF0ZVJlbW92ZVRhYmxlKCk7XG4gICAgfSk7XG5cbiAgICB2YXIgaW5zZXJ0cyA9IGl0ZW1zRGlmZi5maWx0ZXIoZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHJldHVybiBkaWZmSXRlbS50eXBlID09PSAnaW5zZXJ0JztcbiAgICB9KTtcblxuICAgIGluc2VydHMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgdmFyIGFkZGVkID0gbmV3IEFycmF5KGRpZmZJdGVtLnZhbHVlcy5sZW5ndGgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBkaWZmSXRlbS52YWx1ZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICBhZGRlZFtpXSA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogZGlmZkl0ZW0udmFsdWVzW2ldXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkobXV0YXRlZEFycmF5LCBbb2Zmc2V0SW5kZXgoZGlmZkl0ZW0uaW5kZXgpLCAwXS5jb25jYXQoYWRkZWQpKTtcbiAgICB9KTtcblxuICAgIHZhciBvZmZzZXQgPSAwO1xuICAgIG11dGF0ZWRBcnJheS5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIHR5cGUgPSBkaWZmSXRlbS50eXBlO1xuICAgICAgICBpZiAodHlwZSA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgICAgIG9mZnNldCAtPSAxO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzaW1pbGFyJykge1xuICAgICAgICAgICAgZGlmZkl0ZW0uZXhwZWN0ZWQgPSBleHBlY3RlZFtvZmZzZXQgKyBpbmRleF07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHZhciBjb25mbGljdHMgPSBtdXRhdGVkQXJyYXkucmVkdWNlKGZ1bmN0aW9uIChjb25mbGljdHMsIGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0udHlwZSA9PT0gJ3NpbWlsYXInID8gY29uZmxpY3RzIDogY29uZmxpY3RzICsgMTtcbiAgICB9LCAwKTtcblxuICAgIGZvciAodmFyIGkgPSAwLCBjID0gMDsgaSA8IE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCkgJiYgIGMgPD0gY29uZmxpY3RzOyBpICs9IDEpIHtcbiAgICAgICAgdmFyIGV4cGVjdGVkVHlwZSA9IHR5cGVvZiBleHBlY3RlZFtpXTtcbiAgICAgICAgdmFyIGFjdHVhbFR5cGUgPSB0eXBlb2YgYWN0dWFsW2ldO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIGFjdHVhbFR5cGUgIT09IGV4cGVjdGVkVHlwZSB8fFxuICAgICAgICAgICAgICAgICgoYWN0dWFsVHlwZSA9PT0gJ29iamVjdCcgfHwgYWN0dWFsVHlwZSA9PT0gJ3N0cmluZycpICYmICFzaW1pbGFyKGFjdHVhbFtpXSwgZXhwZWN0ZWRbaV0pKSB8fFxuICAgICAgICAgICAgICAgIChhY3R1YWxUeXBlICE9PSAnb2JqZWN0JyAmJiBhY3R1YWxUeXBlICE9PSAnc3RyaW5nJyAmJiAhZXF1YWwoYWN0dWFsW2ldLCBleHBlY3RlZFtpXSkpXG4gICAgICAgICkge1xuICAgICAgICAgICAgYyArPSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGMgPD0gY29uZmxpY3RzKSB7XG4gICAgICAgIG11dGF0ZWRBcnJheSA9IFtdO1xuICAgICAgICB2YXIgajtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IE1hdGgubWluKGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7IGogKz0gMSkge1xuICAgICAgICAgICAgbXV0YXRlZEFycmF5LnB1c2goe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzaW1pbGFyJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogYWN0dWFsW2pdLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZFtqXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWN0dWFsLmxlbmd0aCA8IGV4cGVjdGVkLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yICg7IGogPCBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpOyBqICs9IDEpIHtcbiAgICAgICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZXhwZWN0ZWRbal1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoOyBqIDwgTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTsgaiArPSAxKSB7XG4gICAgICAgICAgICAgICAgbXV0YXRlZEFycmF5LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVtb3ZlJyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGFjdHVhbFtqXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtdXRhdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbXV0YXRlZEFycmF5W211dGF0ZWRBcnJheS5sZW5ndGggLSAxXS5sYXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG11dGF0ZWRBcnJheS5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICBpZiAoZGlmZkl0ZW0udHlwZSA9PT0gJ3NpbWlsYXInICYmIGVxdWFsKGRpZmZJdGVtLnZhbHVlLCBkaWZmSXRlbS5leHBlY3RlZCkpIHtcbiAgICAgICAgICAgIGRpZmZJdGVtLnR5cGUgPSAnZXF1YWwnO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbXV0YXRlZEFycmF5O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gYXJyYXlEaWZmO1xuXG4vLyBCYXNlZCBvbiBzb21lIHJvdWdoIGJlbmNobWFya2luZywgdGhpcyBhbGdvcml0aG0gaXMgYWJvdXQgTygybikgd29yc3QgY2FzZSxcbi8vIGFuZCBpdCBjYW4gY29tcHV0ZSBkaWZmcyBvbiByYW5kb20gYXJyYXlzIG9mIGxlbmd0aCAxMDI0IGluIGFib3V0IDM0bXMsXG4vLyB0aG91Z2gganVzdCBhIGZldyBjaGFuZ2VzIG9uIGFuIGFycmF5IG9mIGxlbmd0aCAxMDI0IHRha2VzIGFib3V0IDAuNW1zXG5cbmFycmF5RGlmZi5JbnNlcnREaWZmID0gSW5zZXJ0RGlmZjtcbmFycmF5RGlmZi5SZW1vdmVEaWZmID0gUmVtb3ZlRGlmZjtcbmFycmF5RGlmZi5Nb3ZlRGlmZiA9IE1vdmVEaWZmO1xuXG5mdW5jdGlvbiBJbnNlcnREaWZmKGluZGV4LCB2YWx1ZXMpIHtcbiAgdGhpcy5pbmRleCA9IGluZGV4O1xuICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbn1cbkluc2VydERpZmYucHJvdG90eXBlLnR5cGUgPSAnaW5zZXJ0Jztcbkluc2VydERpZmYucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IHRoaXMudHlwZVxuICAsIGluZGV4OiB0aGlzLmluZGV4XG4gICwgdmFsdWVzOiB0aGlzLnZhbHVlc1xuICB9O1xufTtcblxuZnVuY3Rpb24gUmVtb3ZlRGlmZihpbmRleCwgaG93TWFueSkge1xuICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gIHRoaXMuaG93TWFueSA9IGhvd01hbnk7XG59XG5SZW1vdmVEaWZmLnByb3RvdHlwZS50eXBlID0gJ3JlbW92ZSc7XG5SZW1vdmVEaWZmLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiB0aGlzLnR5cGVcbiAgLCBpbmRleDogdGhpcy5pbmRleFxuICAsIGhvd01hbnk6IHRoaXMuaG93TWFueVxuICB9O1xufTtcblxuZnVuY3Rpb24gTW92ZURpZmYoZnJvbSwgdG8sIGhvd01hbnkpIHtcbiAgdGhpcy5mcm9tID0gZnJvbTtcbiAgdGhpcy50byA9IHRvO1xuICB0aGlzLmhvd01hbnkgPSBob3dNYW55O1xufVxuTW92ZURpZmYucHJvdG90eXBlLnR5cGUgPSAnbW92ZSc7XG5Nb3ZlRGlmZi5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogdGhpcy50eXBlXG4gICwgZnJvbTogdGhpcy5mcm9tXG4gICwgdG86IHRoaXMudG9cbiAgLCBob3dNYW55OiB0aGlzLmhvd01hbnlcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIHN0cmljdEVxdWFsKGEsIGIpIHtcbiAgcmV0dXJuIGEgPT09IGI7XG59XG5cbmZ1bmN0aW9uIGFycmF5RGlmZihiZWZvcmUsIGFmdGVyLCBlcXVhbEZuKSB7XG4gIGlmICghZXF1YWxGbikgZXF1YWxGbiA9IHN0cmljdEVxdWFsO1xuXG4gIC8vIEZpbmQgYWxsIGl0ZW1zIGluIGJvdGggdGhlIGJlZm9yZSBhbmQgYWZ0ZXIgYXJyYXksIGFuZCByZXByZXNlbnQgdGhlbVxuICAvLyBhcyBtb3Zlcy4gTWFueSBvZiB0aGVzZSBcIm1vdmVzXCIgbWF5IGVuZCB1cCBiZWluZyBkaXNjYXJkZWQgaW4gdGhlIGxhc3RcbiAgLy8gcGFzcyBpZiB0aGV5IGFyZSBmcm9tIGFuIGluZGV4IHRvIHRoZSBzYW1lIGluZGV4LCBidXQgd2UgZG9uJ3Qga25vdyB0aGlzXG4gIC8vIHVwIGZyb250LCBzaW5jZSB3ZSBoYXZlbid0IHlldCBvZmZzZXQgdGhlIGluZGljZXMuXG4gIC8vIFxuICAvLyBBbHNvIGtlZXAgYSBtYXAgb2YgYWxsIHRoZSBpbmRpY2llcyBhY2NvdW50ZWQgZm9yIGluIHRoZSBiZWZvcmUgYW5kIGFmdGVyXG4gIC8vIGFycmF5cy4gVGhlc2UgbWFwcyBhcmUgdXNlZCBuZXh0IHRvIGNyZWF0ZSBpbnNlcnQgYW5kIHJlbW92ZSBkaWZmcy5cbiAgdmFyIGJlZm9yZUxlbmd0aCA9IGJlZm9yZS5sZW5ndGg7XG4gIHZhciBhZnRlckxlbmd0aCA9IGFmdGVyLmxlbmd0aDtcbiAgdmFyIG1vdmVzID0gW107XG4gIHZhciBiZWZvcmVNYXJrZWQgPSB7fTtcbiAgdmFyIGFmdGVyTWFya2VkID0ge307XG4gIGZvciAodmFyIGJlZm9yZUluZGV4ID0gMDsgYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGg7IGJlZm9yZUluZGV4KyspIHtcbiAgICB2YXIgYmVmb3JlSXRlbSA9IGJlZm9yZVtiZWZvcmVJbmRleF07XG4gICAgZm9yICh2YXIgYWZ0ZXJJbmRleCA9IDA7IGFmdGVySW5kZXggPCBhZnRlckxlbmd0aDsgYWZ0ZXJJbmRleCsrKSB7XG4gICAgICBpZiAoYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF0pIGNvbnRpbnVlO1xuICAgICAgaWYgKCFlcXVhbEZuKGJlZm9yZUl0ZW0sIGFmdGVyW2FmdGVySW5kZXhdKSkgY29udGludWU7XG4gICAgICB2YXIgZnJvbSA9IGJlZm9yZUluZGV4O1xuICAgICAgdmFyIHRvID0gYWZ0ZXJJbmRleDtcbiAgICAgIHZhciBob3dNYW55ID0gMDtcbiAgICAgIGRvIHtcbiAgICAgICAgYmVmb3JlTWFya2VkW2JlZm9yZUluZGV4KytdID0gYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleCsrXSA9IHRydWU7XG4gICAgICAgIGhvd01hbnkrKztcbiAgICAgIH0gd2hpbGUgKFxuICAgICAgICBiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aCAmJlxuICAgICAgICBhZnRlckluZGV4IDwgYWZ0ZXJMZW5ndGggJiZcbiAgICAgICAgZXF1YWxGbihiZWZvcmVbYmVmb3JlSW5kZXhdLCBhZnRlclthZnRlckluZGV4XSkgJiZcbiAgICAgICAgIWFmdGVyTWFya2VkW2FmdGVySW5kZXhdXG4gICAgICApO1xuICAgICAgbW92ZXMucHVzaChuZXcgTW92ZURpZmYoZnJvbSwgdG8sIGhvd01hbnkpKTtcbiAgICAgIGJlZm9yZUluZGV4LS07XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBDcmVhdGUgYSByZW1vdmUgZm9yIGFsbCBvZiB0aGUgaXRlbXMgaW4gdGhlIGJlZm9yZSBhcnJheSB0aGF0IHdlcmVcbiAgLy8gbm90IG1hcmtlZCBhcyBiZWluZyBtYXRjaGVkIGluIHRoZSBhZnRlciBhcnJheSBhcyB3ZWxsXG4gIHZhciByZW1vdmVzID0gW107XG4gIGZvciAoYmVmb3JlSW5kZXggPSAwOyBiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aDspIHtcbiAgICBpZiAoYmVmb3JlTWFya2VkW2JlZm9yZUluZGV4XSkge1xuICAgICAgYmVmb3JlSW5kZXgrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YXIgaW5kZXggPSBiZWZvcmVJbmRleDtcbiAgICB2YXIgaG93TWFueSA9IDA7XG4gICAgd2hpbGUgKGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoICYmICFiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXgrK10pIHtcbiAgICAgIGhvd01hbnkrKztcbiAgICB9XG4gICAgcmVtb3Zlcy5wdXNoKG5ldyBSZW1vdmVEaWZmKGluZGV4LCBob3dNYW55KSk7XG4gIH1cblxuICAvLyBDcmVhdGUgYW4gaW5zZXJ0IGZvciBhbGwgb2YgdGhlIGl0ZW1zIGluIHRoZSBhZnRlciBhcnJheSB0aGF0IHdlcmVcbiAgLy8gbm90IG1hcmtlZCBhcyBiZWluZyBtYXRjaGVkIGluIHRoZSBiZWZvcmUgYXJyYXkgYXMgd2VsbFxuICB2YXIgaW5zZXJ0cyA9IFtdO1xuICBmb3IgKGFmdGVySW5kZXggPSAwOyBhZnRlckluZGV4IDwgYWZ0ZXJMZW5ndGg7KSB7XG4gICAgaWYgKGFmdGVyTWFya2VkW2FmdGVySW5kZXhdKSB7XG4gICAgICBhZnRlckluZGV4Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdmFyIGluZGV4ID0gYWZ0ZXJJbmRleDtcbiAgICB2YXIgaG93TWFueSA9IDA7XG4gICAgd2hpbGUgKGFmdGVySW5kZXggPCBhZnRlckxlbmd0aCAmJiAhYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleCsrXSkge1xuICAgICAgaG93TWFueSsrO1xuICAgIH1cbiAgICB2YXIgdmFsdWVzID0gYWZ0ZXIuc2xpY2UoaW5kZXgsIGluZGV4ICsgaG93TWFueSk7XG4gICAgaW5zZXJ0cy5wdXNoKG5ldyBJbnNlcnREaWZmKGluZGV4LCB2YWx1ZXMpKTtcbiAgfVxuXG4gIHZhciBpbnNlcnRzTGVuZ3RoID0gaW5zZXJ0cy5sZW5ndGg7XG4gIHZhciByZW1vdmVzTGVuZ3RoID0gcmVtb3Zlcy5sZW5ndGg7XG4gIHZhciBtb3Zlc0xlbmd0aCA9IG1vdmVzLmxlbmd0aDtcbiAgdmFyIGksIGo7XG5cbiAgLy8gT2Zmc2V0IHN1YnNlcXVlbnQgcmVtb3ZlcyBhbmQgbW92ZXMgYnkgcmVtb3Zlc1xuICB2YXIgY291bnQgPSAwO1xuICBmb3IgKGkgPSAwOyBpIDwgcmVtb3Zlc0xlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHJlbW92ZSA9IHJlbW92ZXNbaV07XG4gICAgcmVtb3ZlLmluZGV4IC09IGNvdW50O1xuICAgIGNvdW50ICs9IHJlbW92ZS5ob3dNYW55O1xuICAgIGZvciAoaiA9IDA7IGogPCBtb3Zlc0xlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgbW92ZSA9IG1vdmVzW2pdO1xuICAgICAgaWYgKG1vdmUuZnJvbSA+PSByZW1vdmUuaW5kZXgpIG1vdmUuZnJvbSAtPSByZW1vdmUuaG93TWFueTtcbiAgICB9XG4gIH1cblxuICAvLyBPZmZzZXQgbW92ZXMgYnkgaW5zZXJ0c1xuICBmb3IgKGkgPSBpbnNlcnRzTGVuZ3RoOyBpLS07KSB7XG4gICAgdmFyIGluc2VydCA9IGluc2VydHNbaV07XG4gICAgdmFyIGhvd01hbnkgPSBpbnNlcnQudmFsdWVzLmxlbmd0aDtcbiAgICBmb3IgKGogPSBtb3Zlc0xlbmd0aDsgai0tOykge1xuICAgICAgdmFyIG1vdmUgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChtb3ZlLnRvID49IGluc2VydC5pbmRleCkgbW92ZS50byAtPSBob3dNYW55O1xuICAgIH1cbiAgfVxuXG4gIC8vIE9mZnNldCB0aGUgdG8gb2YgbW92ZXMgYnkgbGF0ZXIgbW92ZXNcbiAgZm9yIChpID0gbW92ZXNMZW5ndGg7IGktLSA+IDE7KSB7XG4gICAgdmFyIG1vdmUgPSBtb3Zlc1tpXTtcbiAgICBpZiAobW92ZS50byA9PT0gbW92ZS5mcm9tKSBjb250aW51ZTtcbiAgICBmb3IgKGogPSBpOyBqLS07KSB7XG4gICAgICB2YXIgZWFybGllciA9IG1vdmVzW2pdO1xuICAgICAgaWYgKGVhcmxpZXIudG8gPj0gbW92ZS50bykgZWFybGllci50byAtPSBtb3ZlLmhvd01hbnk7XG4gICAgICBpZiAoZWFybGllci50byA+PSBtb3ZlLmZyb20pIGVhcmxpZXIudG8gKz0gbW92ZS5ob3dNYW55O1xuICAgIH1cbiAgfVxuXG4gIC8vIE9ubHkgb3V0cHV0IG1vdmVzIHRoYXQgZW5kIHVwIGhhdmluZyBhbiBlZmZlY3QgYWZ0ZXIgb2Zmc2V0dGluZ1xuICB2YXIgb3V0cHV0TW92ZXMgPSBbXTtcblxuICAvLyBPZmZzZXQgdGhlIGZyb20gb2YgbW92ZXMgYnkgZWFybGllciBtb3Zlc1xuICBmb3IgKGkgPSAwOyBpIDwgbW92ZXNMZW5ndGg7IGkrKykge1xuICAgIHZhciBtb3ZlID0gbW92ZXNbaV07XG4gICAgaWYgKG1vdmUudG8gPT09IG1vdmUuZnJvbSkgY29udGludWU7XG4gICAgb3V0cHV0TW92ZXMucHVzaChtb3ZlKTtcbiAgICBmb3IgKGogPSBpICsgMTsgaiA8IG1vdmVzTGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBsYXRlciA9IG1vdmVzW2pdO1xuICAgICAgaWYgKGxhdGVyLmZyb20gPj0gbW92ZS5mcm9tKSBsYXRlci5mcm9tIC09IG1vdmUuaG93TWFueTtcbiAgICAgIGlmIChsYXRlci5mcm9tID49IG1vdmUudG8pIGxhdGVyLmZyb20gKz0gbW92ZS5ob3dNYW55O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZW1vdmVzLmNvbmNhdChvdXRwdXRNb3ZlcywgaW5zZXJ0cyk7XG59XG4iLCJcblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1jb3JlLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbnZhciBzZWxmID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/IHdpbmRvdyA6IHt9O1xuXG4vKipcbiAqIFByaXNtOiBMaWdodHdlaWdodCwgcm9idXN0LCBlbGVnYW50IHN5bnRheCBoaWdobGlnaHRpbmdcbiAqIE1JVCBsaWNlbnNlIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwL1xuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYS52ZXJvdS5tZVxuICovXG5cbnZhciBQcmlzbSA9IChmdW5jdGlvbigpe1xuXG4vLyBQcml2YXRlIGhlbHBlciB2YXJzXG52YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LSg/IVxcKikoXFx3KylcXGIvaTtcblxudmFyIF8gPSBzZWxmLlByaXNtID0ge1xuXHR1dGlsOiB7XG5cdFx0dHlwZTogZnVuY3Rpb24gKG8pIHsgXG5cdFx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLm1hdGNoKC9cXFtvYmplY3QgKFxcdyspXFxdLylbMV07XG5cdFx0fSxcblx0XHRcblx0XHQvLyBEZWVwIGNsb25lIGEgbGFuZ3VhZ2UgZGVmaW5pdGlvbiAoZS5nLiB0byBleHRlbmQgaXQpXG5cdFx0Y2xvbmU6IGZ1bmN0aW9uIChvKSB7XG5cdFx0XHR2YXIgdHlwZSA9IF8udXRpbC50eXBlKG8pO1xuXG5cdFx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdFx0Y2FzZSAnT2JqZWN0Jzpcblx0XHRcdFx0XHR2YXIgY2xvbmUgPSB7fTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xuXHRcdFx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHJldHVybiBjbG9uZTtcblx0XHRcdFx0XHRcblx0XHRcdFx0Y2FzZSAnQXJyYXknOlxuXHRcdFx0XHRcdHJldHVybiBvLnNsaWNlKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiBvO1xuXHRcdH1cblx0fSxcblx0XG5cdGxhbmd1YWdlczoge1xuXHRcdGV4dGVuZDogZnVuY3Rpb24gKGlkLCByZWRlZikge1xuXHRcdFx0dmFyIGxhbmcgPSBfLnV0aWwuY2xvbmUoXy5sYW5ndWFnZXNbaWRdKTtcblx0XHRcdFxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHJlZGVmKSB7XG5cdFx0XHRcdGxhbmdba2V5XSA9IHJlZGVmW2tleV07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiBsYW5nO1xuXHRcdH0sXG5cdFx0XG5cdFx0Ly8gSW5zZXJ0IGEgdG9rZW4gYmVmb3JlIGFub3RoZXIgdG9rZW4gaW4gYSBsYW5ndWFnZSBsaXRlcmFsXG5cdFx0aW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiAoaW5zaWRlLCBiZWZvcmUsIGluc2VydCwgcm9vdCkge1xuXHRcdFx0cm9vdCA9IHJvb3QgfHwgXy5sYW5ndWFnZXM7XG5cdFx0XHR2YXIgZ3JhbW1hciA9IHJvb3RbaW5zaWRlXTtcblx0XHRcdHZhciByZXQgPSB7fTtcblx0XHRcdFx0XG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XG5cdFx0XHRcblx0XHRcdFx0aWYgKGdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYgKHRva2VuID09IGJlZm9yZSkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXRbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRyZXRbdG9rZW5dID0gZ3JhbW1hclt0b2tlbl07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIHJvb3RbaW5zaWRlXSA9IHJldDtcblx0XHR9LFxuXHRcdFxuXHRcdC8vIFRyYXZlcnNlIGEgbGFuZ3VhZ2UgZGVmaW5pdGlvbiB3aXRoIERlcHRoIEZpcnN0IFNlYXJjaFxuXHRcdERGUzogZnVuY3Rpb24obywgY2FsbGJhY2spIHtcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xuXHRcdFx0XHRjYWxsYmFjay5jYWxsKG8sIGksIG9baV0pO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKF8udXRpbC50eXBlKG8pID09PSAnT2JqZWN0Jykge1xuXHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjayk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcblx0XHR2YXIgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZScpO1xuXG5cdFx0Zm9yICh2YXIgaT0wLCBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudHNbaSsrXTspIHtcblx0XHRcdF8uaGlnaGxpZ2h0RWxlbWVudChlbGVtZW50LCBhc3luYyA9PT0gdHJ1ZSwgY2FsbGJhY2spO1xuXHRcdH1cblx0fSxcblx0XHRcblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Ly8gRmluZCBsYW5ndWFnZVxuXHRcdHZhciBsYW5ndWFnZSwgZ3JhbW1hciwgcGFyZW50ID0gZWxlbWVudDtcblx0XHRcblx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdH1cblx0XHRcblx0XHRpZiAocGFyZW50KSB7XG5cdFx0XHRsYW5ndWFnZSA9IChwYXJlbnQuY2xhc3NOYW1lLm1hdGNoKGxhbmcpIHx8IFssJyddKVsxXTtcblx0XHRcdGdyYW1tYXIgPSBfLmxhbmd1YWdlc1tsYW5ndWFnZV07XG5cdFx0fVxuXG5cdFx0aWYgKCFncmFtbWFyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgZWxlbWVudCwgaWYgbm90IHByZXNlbnRcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xuXHRcdFxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgcGFyZW50LCBmb3Igc3R5bGluZ1xuXHRcdHBhcmVudCA9IGVsZW1lbnQucGFyZW50Tm9kZTtcblx0XHRcblx0XHRpZiAoL3ByZS9pLnRlc3QocGFyZW50Lm5vZGVOYW1lKSkge1xuXHRcdFx0cGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7IFxuXHRcdH1cblxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcblx0XHRcblx0XHRpZighY29kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRjb2RlID0gY29kZS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC9cXHUwMGEwL2csICcgJyk7XG5cdFx0XG5cdFx0dmFyIGVudiA9IHtcblx0XHRcdGVsZW1lbnQ6IGVsZW1lbnQsXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0XHRncmFtbWFyOiBncmFtbWFyLFxuXHRcdFx0Y29kZTogY29kZVxuXHRcdH07XG5cdFx0XG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFxuXHRcdGlmIChhc3luYyAmJiBzZWxmLldvcmtlcikge1xuXHRcdFx0dmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoXy5maWxlbmFtZSk7XHRcblx0XHRcdFxuXHRcdFx0d29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gVG9rZW4uc3RyaW5naWZ5KEpTT04ucGFyc2UoZXZ0LmRhdGEpLCBsYW5ndWFnZSk7XG5cblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1pbnNlcnQnLCBlbnYpO1xuXG5cdFx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cdFx0XHRcdFxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVudi5lbGVtZW50KTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHR9O1xuXHRcdFx0XG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRsYW5ndWFnZTogZW52Lmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBfLmhpZ2hsaWdodChlbnYuY29kZSwgZW52LmdyYW1tYXIsIGVudi5sYW5ndWFnZSlcblxuXHRcdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1pbnNlcnQnLCBlbnYpO1xuXG5cdFx0XHRlbnYuZWxlbWVudC5pbm5lckhUTUwgPSBlbnYuaGlnaGxpZ2h0ZWRDb2RlO1xuXHRcdFx0XG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVsZW1lbnQpO1xuXHRcdFx0XG5cdFx0XHRfLmhvb2tzLnJ1bignYWZ0ZXItaGlnaGxpZ2h0JywgZW52KTtcblx0XHR9XG5cdH0sXG5cdFxuXHRoaWdobGlnaHQ6IGZ1bmN0aW9uICh0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xuXHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoXy50b2tlbml6ZSh0ZXh0LCBncmFtbWFyKSwgbGFuZ3VhZ2UpO1xuXHR9LFxuXHRcblx0dG9rZW5pemU6IGZ1bmN0aW9uKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0dmFyIFRva2VuID0gXy5Ub2tlbjtcblx0XHRcblx0XHR2YXIgc3RyYXJyID0gW3RleHRdO1xuXHRcdFxuXHRcdHZhciByZXN0ID0gZ3JhbW1hci5yZXN0O1xuXHRcdFxuXHRcdGlmIChyZXN0KSB7XG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiByZXN0KSB7XG5cdFx0XHRcdGdyYW1tYXJbdG9rZW5dID0gcmVzdFt0b2tlbl07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGRlbGV0ZSBncmFtbWFyLnJlc3Q7XG5cdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFxuXHRcdHRva2VubG9vcDogZm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dmFyIHBhdHRlcm4gPSBncmFtbWFyW3Rva2VuXSwgXG5cdFx0XHRcdGluc2lkZSA9IHBhdHRlcm4uaW5zaWRlLFxuXHRcdFx0XHRsb29rYmVoaW5kID0gISFwYXR0ZXJuLmxvb2tiZWhpbmQsXG5cdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSAwO1xuXHRcdFx0XG5cdFx0XHRwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuIHx8IHBhdHRlcm47XG5cdFx0XHRcblx0XHRcdGZvciAodmFyIGk9MDsgaTxzdHJhcnIubGVuZ3RoOyBpKyspIHsgLy8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3Bcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoc3RyYXJyLmxlbmd0aCA+IHRleHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Ly8gU29tZXRoaW5nIHdlbnQgdGVycmlibHkgd3JvbmcsIEFCT1JULCBBQk9SVCFcblx0XHRcdFx0XHRicmVhayB0b2tlbmxvb3A7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdGlmIChzdHIgaW5zdGFuY2VvZiBUb2tlbikge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IDA7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMoc3RyKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRcdGlmKGxvb2tiZWhpbmQpIHtcblx0XHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSBtYXRjaFsxXS5sZW5ndGg7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCAtIDEgKyBsb29rYmVoaW5kTGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBtYXRjaCA9IG1hdGNoWzBdLnNsaWNlKGxvb2tiZWhpbmRMZW5ndGgpLFxuXHRcdFx0XHRcdCAgICBsZW4gPSBtYXRjaC5sZW5ndGgsXG5cdFx0XHRcdFx0ICAgIHRvID0gZnJvbSArIGxlbixcblx0XHRcdFx0XHRcdGJlZm9yZSA9IHN0ci5zbGljZSgwLCBmcm9tICsgMSksXG5cdFx0XHRcdFx0XHRhZnRlciA9IHN0ci5zbGljZSh0byArIDEpOyBcblxuXHRcdFx0XHRcdHZhciBhcmdzID0gW2ksIDFdO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChiZWZvcmUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHR2YXIgd3JhcHBlZCA9IG5ldyBUb2tlbih0b2tlbiwgaW5zaWRlPyBfLnRva2VuaXplKG1hdGNoLCBpbnNpZGUpIDogbWF0Y2gpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGFyZ3MucHVzaCh3cmFwcGVkKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRpZiAoYWZ0ZXIpIHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChhZnRlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkoc3RyYXJyLCBhcmdzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBzdHJhcnI7XG5cdH0sXG5cdFxuXHRob29rczoge1xuXHRcdGFsbDoge30sXG5cdFx0XG5cdFx0YWRkOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xuXHRcdFx0XG5cdFx0XHRob29rc1tuYW1lXSA9IGhvb2tzW25hbWVdIHx8IFtdO1xuXHRcdFx0XG5cdFx0XHRob29rc1tuYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0XHR9LFxuXHRcdFxuXHRcdHJ1bjogZnVuY3Rpb24gKG5hbWUsIGVudikge1xuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xuXHRcdFx0XG5cdFx0XHRpZiAoIWNhbGxiYWNrcyB8fCAhY2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XG5cdFx0XHRcdGNhbGxiYWNrKGVudik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG52YXIgVG9rZW4gPSBfLlRva2VuID0gZnVuY3Rpb24odHlwZSwgY29udGVudCkge1xuXHR0aGlzLnR5cGUgPSB0eXBlO1xuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xufTtcblxuVG9rZW4uc3RyaW5naWZ5ID0gZnVuY3Rpb24obywgbGFuZ3VhZ2UsIHBhcmVudCkge1xuXHRpZiAodHlwZW9mIG8gPT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gbztcblx0fVxuXG5cdGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuXHRcdHJldHVybiBvLm1hcChmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KGVsZW1lbnQsIGxhbmd1YWdlLCBvKTtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXHRcblx0dmFyIGVudiA9IHtcblx0XHR0eXBlOiBvLnR5cGUsXG5cdFx0Y29udGVudDogVG9rZW4uc3RyaW5naWZ5KG8uY29udGVudCwgbGFuZ3VhZ2UsIHBhcmVudCksXG5cdFx0dGFnOiAnc3BhbicsXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXG5cdFx0YXR0cmlidXRlczoge30sXG5cdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdHBhcmVudDogcGFyZW50XG5cdH07XG5cdFxuXHRpZiAoZW52LnR5cGUgPT0gJ2NvbW1lbnQnKSB7XG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3NwZWxsY2hlY2snXSA9ICd0cnVlJztcblx0fVxuXHRcblx0Xy5ob29rcy5ydW4oJ3dyYXAnLCBlbnYpO1xuXHRcblx0dmFyIGF0dHJpYnV0ZXMgPSAnJztcblx0XG5cdGZvciAodmFyIG5hbWUgaW4gZW52LmF0dHJpYnV0ZXMpIHtcblx0XHRhdHRyaWJ1dGVzICs9IG5hbWUgKyAnPVwiJyArIChlbnYuYXR0cmlidXRlc1tuYW1lXSB8fCAnJykgKyAnXCInO1xuXHR9XG5cdFxuXHRyZXR1cm4gJzwnICsgZW52LnRhZyArICcgY2xhc3M9XCInICsgZW52LmNsYXNzZXMuam9pbignICcpICsgJ1wiICcgKyBhdHRyaWJ1dGVzICsgJz4nICsgZW52LmNvbnRlbnQgKyAnPC8nICsgZW52LnRhZyArICc+Jztcblx0XG59O1xuXG5pZiAoIXNlbGYuZG9jdW1lbnQpIHtcblx0aWYgKCFzZWxmLmFkZEV2ZW50TGlzdGVuZXIpIHtcblx0XHQvLyBpbiBOb2RlLmpzXG5cdFx0cmV0dXJuIHNlbGYuUHJpc207XG5cdH1cbiBcdC8vIEluIHdvcmtlclxuXHRzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihldnQpIHtcblx0XHR2YXIgbWVzc2FnZSA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpLFxuXHRcdCAgICBsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcblx0XHQgICAgY29kZSA9IG1lc3NhZ2UuY29kZTtcblx0XHRcblx0XHRzZWxmLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KF8udG9rZW5pemUoY29kZSwgXy5sYW5ndWFnZXNbbGFuZ10pKSk7XG5cdFx0c2VsZi5jbG9zZSgpO1xuXHR9LCBmYWxzZSk7XG5cdFxuXHRyZXR1cm4gc2VsZi5QcmlzbTtcbn1cblxuLy8gR2V0IGN1cnJlbnQgc2NyaXB0IGFuZCBoaWdobGlnaHRcbnZhciBzY3JpcHQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0Jyk7XG5cbnNjcmlwdCA9IHNjcmlwdFtzY3JpcHQubGVuZ3RoIC0gMV07XG5cbmlmIChzY3JpcHQpIHtcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XG5cdFxuXHRpZiAoZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciAmJiAhc2NyaXB0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1tYW51YWwnKSkge1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBfLmhpZ2hsaWdodEFsbCk7XG5cdH1cbn1cblxucmV0dXJuIHNlbGYuUHJpc207XG5cbn0pKCk7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRtb2R1bGUuZXhwb3J0cyA9IFByaXNtO1xufVxuXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgIEJlZ2luIHByaXNtLW1hcmt1cC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMubWFya3VwID0ge1xuXHQnY29tbWVudCc6IC8mbHQ7IS0tW1xcd1xcV10qPy0tPi9nLFxuXHQncHJvbG9nJzogLyZsdDtcXD8uKz9cXD8+Lyxcblx0J2RvY3R5cGUnOiAvJmx0OyFET0NUWVBFLis/Pi8sXG5cdCdjZGF0YSc6IC8mbHQ7IVxcW0NEQVRBXFxbW1xcd1xcV10qP11dPi9pLFxuXHQndGFnJzoge1xuXHRcdHBhdHRlcm46IC8mbHQ7XFwvP1tcXHc6LV0rXFxzKig/OlxccytbXFx3Oi1dKyg/Oj0oPzooXCJ8JykoXFxcXD9bXFx3XFxXXSkqP1xcMXxbXlxccydcIj49XSspKT9cXHMqKSpcXC8/Pi9naSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCd0YWcnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9eJmx0O1xcLz9bXFx3Oi1dKy9pLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXiZsdDtcXC8/Lyxcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXFx3LV0rPzovXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0cGF0dGVybjogLz0oPzooJ3xcIilbXFx3XFxXXSo/KFxcMSl8W15cXHM+XSspL2dpLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvPXw+fFwiL2dcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdwdW5jdHVhdGlvbic6IC9cXC8/Pi9nLFxuXHRcdFx0J2F0dHItbmFtZSc6IHtcblx0XHRcdFx0cGF0dGVybjogL1tcXHc6LV0rL2csXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXltcXHctXSs/Oi9cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fVxuXHR9LFxuXHQnZW50aXR5JzogLyZhbXA7Iz9bXFxkYS16XXsxLDh9Oy9naVxufTtcblxuLy8gUGx1Z2luIHRvIG1ha2UgZW50aXR5IHRpdGxlIHNob3cgdGhlIHJlYWwgZW50aXR5LCBpZGVhIGJ5IFJvbWFuIEtvbWFyb3ZcblByaXNtLmhvb2tzLmFkZCgnd3JhcCcsIGZ1bmN0aW9uKGVudikge1xuXG5cdGlmIChlbnYudHlwZSA9PT0gJ2VudGl0eScpIHtcblx0XHRlbnYuYXR0cmlidXRlc1sndGl0bGUnXSA9IGVudi5jb250ZW50LnJlcGxhY2UoLyZhbXA7LywgJyYnKTtcblx0fVxufSk7XG5cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1jc3MuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNzcyA9IHtcblx0J2NvbW1lbnQnOiAvXFwvXFwqW1xcd1xcV10qP1xcKlxcLy9nLFxuXHQnYXRydWxlJzoge1xuXHRcdHBhdHRlcm46IC9AW1xcdy1dKz8uKj8oO3woPz1cXHMqeykpL2dpLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1s7Ol0vZ1xuXHRcdH1cblx0fSxcblx0J3VybCc6IC91cmxcXCgoW1wiJ10/KS4qP1xcMVxcKS9naSxcblx0J3NlbGVjdG9yJzogL1teXFx7XFx9XFxzXVteXFx7XFx9O10qKD89XFxzKlxceykvZyxcblx0J3Byb3BlcnR5JzogLyhcXGJ8XFxCKVtcXHctXSsoPz1cXHMqOikvaWcsXG5cdCdzdHJpbmcnOiAvKFwifCcpKFxcXFw/LikqP1xcMS9nLFxuXHQnaW1wb3J0YW50JzogL1xcQiFpbXBvcnRhbnRcXGIvZ2ksXG5cdCdpZ25vcmUnOiAvJihsdHxndHxhbXApOy9naSxcblx0J3B1bmN0dWF0aW9uJzogL1tcXHtcXH07Ol0vZ1xufTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc3R5bGUnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKCZsdDt8PClzdHlsZVtcXHdcXFddKj8oPnwmZ3Q7KVtcXHdcXFddKj8oJmx0O3w8KVxcL3N0eWxlKD58Jmd0OykvaWcsXG5cdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvKCZsdDt8PClzdHlsZVtcXHdcXFddKj8oPnwmZ3Q7KXwoJmx0O3w8KVxcL3N0eWxlKD58Jmd0OykvaWcsXG5cdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZy5pbnNpZGVcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVzdDogUHJpc20ubGFuZ3VhZ2VzLmNzc1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xuXHQnY29tbWVudCc6IHtcblx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSkoXFwvXFwqW1xcd1xcV10qP1xcKlxcL3woXnxbXjpdKVxcL1xcLy4qPyhcXHI/XFxufCQpKS9nLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0fSxcblx0J3N0cmluZyc6IC8oXCJ8JykoXFxcXD8uKSo/XFwxL2csXG5cdCdjbGFzcy1uYW1lJzoge1xuXHRcdHBhdHRlcm46IC8oKD86KD86Y2xhc3N8aW50ZXJmYWNlfGV4dGVuZHN8aW1wbGVtZW50c3x0cmFpdHxpbnN0YW5jZW9mfG5ldylcXHMrKXwoPzpjYXRjaFxccytcXCgpKVthLXowLTlfXFwuXFxcXF0rL2lnLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHRwdW5jdHVhdGlvbjogLyhcXC58XFxcXCkvXG5cdFx0fVxuXHR9LFxuXHQna2V5d29yZCc6IC9cXGIoaWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258bmV3fHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWUpXFxiL2csXG5cdCdib29sZWFuJzogL1xcYih0cnVlfGZhbHNlKVxcYi9nLFxuXHQnZnVuY3Rpb24nOiB7XG5cdFx0cGF0dGVybjogL1thLXowLTlfXStcXCgvaWcsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHRwdW5jdHVhdGlvbjogL1xcKC9cblx0XHR9XG5cdH0sXG5cdCdudW1iZXInOiAvXFxiLT8oMHhbXFxkQS1GYS1mXSt8XFxkKlxcLj9cXGQrKFtFZV0tP1xcZCspPylcXGIvZyxcblx0J29wZXJhdG9yJzogL1stK117MSwyfXwhfCZsdDs9P3w+PT98PXsxLDN9fCgmYW1wOyl7MSwyfXxcXHw/XFx8fFxcP3xcXCp8XFwvfFxcfnxcXF58XFwlL2csXG5cdCdpZ25vcmUnOiAvJihsdHxndHxhbXApOy9naSxcblx0J3B1bmN0dWF0aW9uJzogL1t7fVtcXF07KCksLjpdL2dcbn07XG5cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1qYXZhc2NyaXB0LmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0ID0gUHJpc20ubGFuZ3VhZ2VzLmV4dGVuZCgnY2xpa2UnLCB7XG5cdCdrZXl3b3JkJzogL1xcYih2YXJ8bGV0fGlmfGVsc2V8d2hpbGV8ZG98Zm9yfHJldHVybnxpbnxpbnN0YW5jZW9mfGZ1bmN0aW9ufGdldHxzZXR8bmV3fHdpdGh8dHlwZW9mfHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWV8dGhpcylcXGIvZyxcblx0J251bWJlcic6IC9cXGItPygweFtcXGRBLUZhLWZdK3xcXGQqXFwuP1xcZCsoW0VlXS0/XFxkKyk/fE5hTnwtP0luZmluaXR5KVxcYi9nXG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnamF2YXNjcmlwdCcsICdrZXl3b3JkJywge1xuXHQncmVnZXgnOiB7XG5cdFx0cGF0dGVybjogLyhefFteL10pXFwvKD8hXFwvKShcXFsuKz9dfFxcXFwufFteL1xcclxcbl0pK1xcL1tnaW1dezAsM30oPz1cXHMqKCR8W1xcclxcbiwuO30pXSkpL2csXG5cdFx0bG9va2JlaGluZDogdHJ1ZVxuXHR9XG59KTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc2NyaXB0Jzoge1xuXHRcdFx0cGF0dGVybjogLygmbHQ7fDwpc2NyaXB0W1xcd1xcV10qPyg+fCZndDspW1xcd1xcV10qPygmbHQ7fDwpXFwvc2NyaXB0KD58Jmd0OykvaWcsXG5cdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvKCZsdDt8PClzY3JpcHRbXFx3XFxXXSo/KD58Jmd0Oyl8KCZsdDt8PClcXC9zY3JpcHQoPnwmZ3Q7KS9pZyxcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5tYXJrdXAudGFnLmluc2lkZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZXN0OiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1maWxlLWhpZ2hsaWdodC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG4oZnVuY3Rpb24oKXtcblxuaWYgKCFzZWxmLlByaXNtIHx8ICFzZWxmLmRvY3VtZW50IHx8ICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKSB7XG5cdHJldHVybjtcbn1cblxudmFyIEV4dGVuc2lvbnMgPSB7XG5cdCdqcyc6ICdqYXZhc2NyaXB0Jyxcblx0J2h0bWwnOiAnbWFya3VwJyxcblx0J3N2Zyc6ICdtYXJrdXAnXG59O1xuXG5BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24ocHJlKSB7XG5cdHZhciBzcmMgPSBwcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xuXHR2YXIgZXh0ZW5zaW9uID0gKHNyYy5tYXRjaCgvXFwuKFxcdyspJC8pIHx8IFssJyddKVsxXTtcblx0dmFyIGxhbmd1YWdlID0gRXh0ZW5zaW9uc1tleHRlbnNpb25dIHx8IGV4dGVuc2lvbjtcblx0XG5cdHZhciBjb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY29kZScpO1xuXHRjb2RlLmNsYXNzTmFtZSA9ICdsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cdFxuXHRwcmUudGV4dENvbnRlbnQgPSAnJztcblx0XG5cdGNvZGUudGV4dENvbnRlbnQgPSAnTG9hZGluZ+KApic7XG5cdFxuXHRwcmUuYXBwZW5kQ2hpbGQoY29kZSk7XG5cdFxuXHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdFxuXHR4aHIub3BlbignR0VUJywgc3JjLCB0cnVlKTtcblxuXHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFxuXHRcdFx0aWYgKHhoci5zdGF0dXMgPCA0MDAgJiYgeGhyLnJlc3BvbnNlVGV4dCkge1xuXHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0geGhyLnJlc3BvbnNlVGV4dDtcblx0XHRcdFxuXHRcdFx0XHRQcmlzbS5oaWdobGlnaHRFbGVtZW50KGNvZGUpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoeGhyLnN0YXR1cyA+PSA0MDApIHtcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3IgJyArIHhoci5zdGF0dXMgKyAnIHdoaWxlIGZldGNoaW5nIGZpbGU6ICcgKyB4aHIuc3RhdHVzVGV4dDtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvcjogRmlsZSBkb2VzIG5vdCBleGlzdCBvciBpcyBlbXB0eSc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXHRcblx0eGhyLnNlbmQobnVsbCk7XG59KTtcblxufSkoKTsiLCJ2YXIgcHJpc20gPSByZXF1aXJlKCcuLi8zcmRwYXJ0eS9wcmlzbScpLFxuICAgIGRlZmF1bHRUaGVtZSA9IHtcbiAgICAgICAgLy8gQWRhcHRlZCBmcm9tIHRoZSBkZWZhdWx0IFByaXNtIHRoZW1lOlxuICAgICAgICBwcmlzbUNvbW1lbnQ6ICcjNzA4MDkwJywgLy8gc2xhdGVncmF5XG4gICAgICAgIHByaXNtUHJvbG9nOiAncHJpc21Db21tZW50JyxcbiAgICAgICAgcHJpc21Eb2N0eXBlOiAncHJpc21Db21tZW50JyxcbiAgICAgICAgcHJpc21DZGF0YTogJ3ByaXNtQ29tbWVudCcsXG5cbiAgICAgICAgcHJpc21QdW5jdHVhdGlvbjogJyM5OTknLFxuXG4gICAgICAgIHByaXNtU3ltYm9sOiAnIzkwNScsXG4gICAgICAgIHByaXNtUHJvcGVydHk6ICdwcmlzbVN5bWJvbCcsXG4gICAgICAgIHByaXNtVGFnOiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbUJvb2xlYW46ICdwcmlzbVN5bWJvbCcsXG4gICAgICAgIHByaXNtTnVtYmVyOiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbUNvbnN0YW50OiAncHJpc21TeW1ib2wnLFxuICAgICAgICBwcmlzbURlbGV0ZWQ6ICdwcmlzbVN5bWJvbCcsXG5cbiAgICAgICAgcHJpc21TdHJpbmc6ICcjNjkwJyxcbiAgICAgICAgcHJpc21TZWxlY3RvcjogJ3ByaXNtU3RyaW5nJyxcbiAgICAgICAgcHJpc21BdHRyTmFtZTogJ3ByaXNtU3RyaW5nJyxcbiAgICAgICAgcHJpc21DaGFyOiAncHJpc21TdHJpbmcnLFxuICAgICAgICBwcmlzbUJ1aWx0aW46ICdwcmlzbVN0cmluZycsXG4gICAgICAgIHByaXNtSW5zZXJ0ZWQ6ICdwcmlzbVN0cmluZycsXG5cbiAgICAgICAgcHJpc21PcGVyYXRvcjogJyNhNjdmNTknLFxuICAgICAgICBwcmlzbVZhcmlhYmxlOiAncHJpc21PcGVyYXRvcicsXG4gICAgICAgIHByaXNtRW50aXR5OiAncHJpc21PcGVyYXRvcicsXG4gICAgICAgIHByaXNtVXJsOiAncHJpc21PcGVyYXRvcicsXG4gICAgICAgIHByaXNtQ3NzU3RyaW5nOiAncHJpc21PcGVyYXRvcicsXG5cbiAgICAgICAgcHJpc21LZXl3b3JkOiAnIzA3YScsXG4gICAgICAgIHByaXNtQXRydWxlOiAncHJpc21LZXl3b3JkJyxcbiAgICAgICAgcHJpc21BdHRyVmFsdWU6ICdwcmlzbUtleXdvcmQnLFxuXG4gICAgICAgIHByaXNtRnVuY3Rpb246ICcjREQ0QTY4JyxcblxuICAgICAgICBwcmlzbVJlZ2V4OiAnI2U5MCcsXG4gICAgICAgIHByaXNtSW1wb3J0YW50OiBbJyNlOTAnLCAnYm9sZCddXG4gICAgfSxcbiAgICBsYW5ndWFnZU1hcHBpbmcgPSB7XG4gICAgICAgICd0ZXh0L2h0bWwnOiAnbWFya3VwJyxcbiAgICAgICAgJ2FwcGxpY2F0aW9uL3htbCc6ICdtYXJrdXAnLFxuICAgICAgICAndGV4dC94bWwnOiAnbWFya3VwJyxcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnamF2YXNjcmlwdCcsXG4gICAgICAgICd0ZXh0L2phdmFzY3JpcHQnOiAnamF2YXNjcmlwdCcsXG4gICAgICAgICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogJ2phdmFzY3JpcHQnLFxuICAgICAgICAndGV4dC9jc3MnOiAnY3NzJyxcbiAgICAgICAgaHRtbDogJ21hcmt1cCcsXG4gICAgICAgIHhtbDogJ21hcmt1cCcsXG4gICAgICAgIGM6ICdjbGlrZScsXG4gICAgICAgICdjKysnOiAnY2xpa2UnLFxuICAgICAgICAnY3BwJzogJ2NsaWtlJyxcbiAgICAgICAgJ2MjJzogJ2NsaWtlJyxcbiAgICAgICAgamF2YTogJ2NsaWtlJ1xuICAgIH07XG5cbmZ1bmN0aW9uIHVwcGVyQ2FtZWxDYXNlKHN0cikge1xuICAgIHJldHVybiBzdHIucmVwbGFjZSgvKD86XnwtKShbYS16XSkvZywgZnVuY3Rpb24gKCQwLCBjaCkge1xuICAgICAgICByZXR1cm4gY2gudG9VcHBlckNhc2UoKTtcbiAgICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgbmFtZTogJ21hZ2ljcGVuLXByaXNtJyxcbiAgICBpbnN0YWxsSW50bzogZnVuY3Rpb24gKG1hZ2ljUGVuKSB7XG4gICAgICAgIG1hZ2ljUGVuLmluc3RhbGxUaGVtZShkZWZhdWx0VGhlbWUpO1xuXG4gICAgICAgIG1hZ2ljUGVuLmFkZFN0eWxlKCdjb2RlJywgZnVuY3Rpb24gKHNvdXJjZVRleHQsIGxhbmd1YWdlKSB7XG4gICAgICAgICAgICBpZiAobGFuZ3VhZ2UgaW4gbGFuZ3VhZ2VNYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2UgPSBsYW5ndWFnZU1hcHBpbmdbbGFuZ3VhZ2VdO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgvXFwreG1sXFxiLy50ZXN0KGxhbmd1YWdlKSkge1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlID0gJ21hcmt1cCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShsYW5ndWFnZSBpbiBwcmlzbS5sYW5ndWFnZXMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudGV4dChzb3VyY2VUZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc291cmNlVGV4dCA9IHNvdXJjZVRleHQucmVwbGFjZSgvPC9nLCAnJmx0OycpOyAvLyBQcmlzbWlzbVxuXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgY2FwaXRhbGl6ZWRMYW5ndWFnZSA9IHVwcGVyQ2FtZWxDYXNlKGxhbmd1YWdlKTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gcHJpbnRUb2tlbnModG9rZW4sIHBhcmVudFN0eWxlKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodG9rZW4pKSB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuLmZvckVhY2goZnVuY3Rpb24gKHN1YlRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmludFRva2VucyhzdWJUb2tlbiwgcGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlID0gdXBwZXJDYW1lbENhc2UocGFyZW50U3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHRva2VuLnJlcGxhY2UoLyZsdDsvZywgJzwnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXRbJ3ByaXNtJyArIGNhcGl0YWxpemVkTGFuZ3VhZ2UgKyB1cHBlckNhbWVsQ2FzZWRQYXJlbnRTdHlsZV0odG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoYXRbJ3ByaXNtJyArIHVwcGVyQ2FtZWxDYXNlZFBhcmVudFN0eWxlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdFsncHJpc20nICsgdXBwZXJDYW1lbENhc2VkUGFyZW50U3R5bGVdKHRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudGV4dCh0b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcmludFRva2Vucyh0b2tlbi5jb250ZW50LCB0b2tlbi50eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmludFRva2VucyhwcmlzbS50b2tlbml6ZShzb3VyY2VUZXh0LCBwcmlzbS5sYW5ndWFnZXNbbGFuZ3VhZ2VdKSwgJ3RleHQnKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxufTtcbiJdfQ==
