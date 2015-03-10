var arrayChanges = require('array-changes');

function getAttributes(element) {
  var attrs = element.attributes;
  var result = {};

  for (var i = 0; i < attrs.length; i += 1) {
    result[attrs[i].name] = attrs[i].value || true;
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

function isVoidElement(elementName) {
  return (/(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)/i).test(elementName);
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

function stringifyStartTag(element) {
  var elementName = element.nodeName.toLowerCase();
  var str = '<' + elementName;
  var attrs = getCanonicalAttributes(element);

  Object.keys(attrs).forEach(function (key) {
    if (isBooleanAttribute(key)) {
      str += ' ' + key;
    } else {
      str += ' ' + key + '="' + attrs[key].replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
    }
  });

  str += '>';
  return str;
}

function stringifyEndTag(element) {
  var elementName = element.nodeName.toLowerCase();
  if (isVoidElement(elementName) && element.childNodes.length === 0) {
    return '';
  } else {
    return '</' + elementName + '>';
  }
}

module.exports = {
  name: 'unexpected-dom',
  installInto: function (expect) {

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
        return obj && obj.nodeType === 8;
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
        return obj && obj.nodeType === 3;
      },
      equal: function (a, b) {
        return a.nodeValue.trim() === b.nodeValue.trim();
      },
      inspect: function (element, depth, output) {
        return output.code(element.nodeValue.trim().replace(/</g, '&lt;'), 'html');
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
      name: 'HTMLDocument',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && obj.nodeType === 9 && obj.documentElement && obj.implementation;
      }
    });

    expect.addType({
      name: 'HTMLElement',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && obj.nodeType === 1 && obj.nodeName && obj.attributes && obj.outerHTML;
      },
      equal: function (a, b, equal) {
        return a.nodeName.toLowerCase() === b.nodeName.toLowerCase() && equal(getAttributes(a), getAttributes(b)) && equal(a.childNodes, b.childNodes);
      },
      inspect: function (element, depth, output, inspect) {
        var elementName = element.nodeName.toLowerCase();
        var startTag = '<' + elementName;
        var attrs = getCanonicalAttributes(element);

        Object.keys(attrs).forEach(function (key) {
          if (isBooleanAttribute(key)) {
            startTag += ' ' + key;
          } else {
            startTag += ' ' + key + '="' + attrs[key].replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
          }
        });

        var inspectedChildren = [];
        for (var i = 0 ; i < element.childNodes.length ; i += 1) {
          inspectedChildren.push(inspect(element.childNodes[i]));
        }

        var width = 0;
        var multipleLines = inspectedChildren.some(function (o) {
          var size = o.size();
          width += size.width;
          return width > 50 || o.height > 1;
        });

        startTag += '>';
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
        output.code(stringifyEndTag(element));
        return output;
      },
      diffLimit: 512,
      diff: function (actual, expected, output, diff, inspect, equal) {
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

        if (!conflictingElement) {
          output.code(stringifyStartTag(actual), 'html');
        } else if (!emptyElements) {
          output.append(diff(stringifyStartTag(actual), stringifyStartTag(expected)).diff);
        }

        if (!emptyElements) {
          var changes = arrayChanges(Array.prototype.slice.call(actual.childNodes), Array.prototype.slice.call(expected.childNodes), equal, function (a, b) {
            // Figure out whether a and b are "struturally similar" so they can be diffed inline.
            // TODO: Consider similarity of the child nodes

            return (
              a.nodeType === 1 && b.nodeType === 1 &&
              a.nodeName === b.nodeName
            );
          });
          output.nl().indentLines();

          changes.forEach(function (diffItem, index) {
            output.i().block(function () {
              var type = diffItem.type;
              // var last = !!diffItem.last;

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
            }).nl();
          });
          output.outdentLines();
        }

        if (emptyElements && conflictingElement) {
          output.append(diff(stringifyStartTag(actual) + stringifyEndTag(actual), stringifyStartTag(expected) + stringifyEndTag(expected)).diff);
        } else {
          if (actual.nodeName.toLowerCase() === expected.nodeName.toLowerCase()) {
            output.code(stringifyEndTag(actual), 'html');
          } else {
            output.append(diff(stringifyEndTag(actual), stringifyEndTag(expected)).diff);
          }
        }

        return result;
      }
    });

    expect.addAssertion('HTMLElement', 'to [only] have (attribute|attributes)', function (expect, subject, cmp) {
      var attrs = getAttributes(subject);

      if (typeof cmp === 'string') {
        expect(attrs, 'to [only] have keys', Array.prototype.slice.call(arguments, 2));
      } else if (Array.isArray(cmp)) {
        expect(attrs, 'to [only] have keys', cmp);
      } else {
        this.flags.exhaustively = this.flags.only;

        expect(attrs, 'to [exhaustively] satisfy', cmp);
      }
    });

    expect.addAssertion('HTMLElement', 'to have [no] (child|children)', function (expect, subject, query, cmp) {
      if (this.flags.no) {
        this.errorMode = 'nested';
        return expect(Array.prototype.slice.call(subject.childNodes), 'to be an empty array');
      } else {
        var children = Array.prototype.slice.call(subject.querySelectorAll(query));
        throw children;
      }
    });

    expect.addAssertion(['HTMLDocument', 'HTMLElement'], 'queried for [first]', function (expect, subject, value) {
      this.shift(expect, this.flags.first ? subject.querySelector(value) : subject.querySelectorAll(value), 1);
    });
  }
};
