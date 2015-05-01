var arrayChanges = require('array-changes');
var extend = require('extend');

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

function getAttributes(element) {
  var attrs = element.attributes;
  var result = {};

  for (var i = 0; i < attrs.length; i += 1) {
    if (attrs[i].name === 'class') {
      result[attrs[i].name] = attrs[i].value && attrs[i].value.split(' ') || [];
    } else if (attrs[i].name === 'style') {
      result[attrs[i].name] = styleStringToObject(attrs[i].value);
    } else {
      result[attrs[i].name] = isBooleanAttribute(attrs[i].name) ? true : (attrs[i].value || '');
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

function isVoidElement(elementName) {
  return (/(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)/i).test(elementName);
}

function styleStringToObject(str) {
  var styles = {};

  str.split(';').forEach(function (rule) {
    var touple = rule.split(':').map(function (part) { return part.trim(); });

    styles[touple[0]] = touple[1];
  });

  return styles;
}

function stringifyStartTag(element) {
  var elementName = element.nodeName.toLowerCase();
  var str = '<' + elementName;
  var attrs = getCanonicalAttributes(element);

  Object.keys(attrs).forEach(function (key) {
    if (isBooleanAttribute(key)) {
      str += ' ' + key;
    } else if (key === 'class') {
      str += ' class="' + attrs[key].join(' ') + '"';
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
      name: 'HTMLDocument',
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
      name: 'HTMLElement',
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
          output.nl().indentLines();
          diffNodeLists(actual.childNodes, expected.childNodes, output, diff, inspect, equal);
          output.nl().outdentLines();
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
      var cmpClasses;
      var cmpStyles;

      if (typeof cmp === 'string') {
        cmp = Array.prototype.slice.call(arguments, 2);
      }

      if (Array.isArray(cmp)) {
        expect(attrs, 'to [only] have keys', cmp);
      } else if (typeof cmp === 'object') {
        this.flags.exhaustively = this.flags.only;

        var comparator = extend({}, cmp);

        if (cmp['class']) {
          if (typeof cmp['class'] === 'string') {
            cmpClasses = cmp['class'].split(' ');
          } else {
            cmpClasses = cmp['class'];
          }
        }

        if (cmp.style) {
          if (typeof cmp.style === 'string') {
            cmpStyles = styleStringToObject(cmp.style);
          } else {
            cmpStyles = cmp.style;
          }
        }

        if (this.flags.exhaustively) {
          if (cmp['class']) {
            var cmpClassesCopy = cmpClasses.slice();
            cmpClasses = [];
            attrs['class'].forEach(function (className) {
              var idx = cmpClassesCopy.indexOf(className);

              if (idx !== -1) {
                cmpClasses.push(cmpClassesCopy.splice(idx, 1)[0]);
              }
            });

            cmpClasses = cmpClasses.concat(cmpClassesCopy);

            if (cmp['class']) {
              comparator['class'] = cmpClasses;
            }
          }

          return expect(attrs, 'to [exhaustively] satisfy', comparator);
        } else {
          if (cmp['class']) {
            comparator['class'] = expect.it.apply(null, ['to contain'].concat(cmpClasses));
          }

          if (cmp.style) {
            comparator.style = expect.it('to satisfy', cmpStyles);
          }

          return expect(attrs, 'to satisfy', comparator);
        }
      } else {
        throw new Error('Please supply either strings, array, or object');
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

    expect.addAssertion('HTMLElement', 'to have text', function (expect, subject, value) {
      return expect(subject.textContent, 'to satisfy', value);
    });

    expect.addAssertion(['HTMLDocument', 'HTMLElement'], 'queried for [first]', function (expect, subject, value) {
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
      this.shift(expect, queryResult, 1);
    });

    expect.addAssertion('string', 'when parsed as (html|HTML)', function (expect, subject) {
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
          throw new Error('The assertion `when parsed as html` was run outside a browser, but could not find the `jsdom` module. Please npm install jsdom to make this work.');
        }
      }
      return this.shift(expect, htmlDocument, 0);
    });
  }
};
