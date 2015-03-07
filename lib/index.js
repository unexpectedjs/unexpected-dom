/*global HTMLDocument*/
function getAttributes(elm) {
  var attrs = elm.attributes;
  var result = {};

  for (var i = 0; i < attrs.length; i += 1) {
    result[attrs[i].name] = attrs[i].value || true;
  }

  return result;
}

function getCanonicalAttributes(elm) {
  var attrs = getAttributes(elm);
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


function stringifyElement(elm) {
  var elementName = elm.nodeName.toLowerCase();
  var str = '<' + elementName;
  var attrs = getCanonicalAttributes(elm);

  Object.keys(attrs).forEach(function (key) {
    if (isBooleanAttribute(key)) {
      str += ' ' + key;
    } else {
      str += ' ' + key + '="' + attrs[key].replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
    }
  });

  str += '>';
  if (!isVoidElement(elementName)) {
    if (elm.children.length > 0) {
      str += '...';
    }
    str += '</' + elementName + '>';
  }
  return str;
}

module.exports = {
  name: 'unexpected-dom',
  installInto: function (expect) {

    expect.addType({
      name: 'DOMNode',
      base: 'object',
      identify: function (obj) {
        if (!obj) {
          return false;
        }

        return obj.nodeName && [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].indexOf(obj.nodeType) > -1;
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
        if (!obj) {
          return false;
        }

        return obj.nodeType === 8;
      },
      equal: function (a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect: function (element, depth, output) {
        return output.code('<!--' + element.nodeValue + '-->', 'html');
      }
    });

    expect.addType({
      name: 'HTMLDocument',
      base: 'DOMNode',
      identify: function (obj) {
        if ('HTMLDocument' in this) {
          return obj instanceof HTMLDocument;
        }

        if (typeof window !== 'undefined') {
          return obj instanceof window.HTMLDocument;
        }

        // Stupid duck typing case. Help :)
        return obj && obj.documentElement && obj.implementation;
      }
    });

    expect.addType({
      name: 'HTMLElement',
      base: 'DOMNode',
      identify: function (obj) {
        if (!obj) {
          return false;
        }

        if ('HTMLElement' in this) {
          return obj instanceof HTMLElement;
        }

        if (typeof window !== 'undefined') {
          return obj instanceof window.HTMLElement;
        }

        var doc = obj.ownerDocument;
        if (doc) {
          var win = doc.defaultView || doc.parentWindow;
          return obj instanceof win.HTMLElement;
        }

        return !!(obj.nodeName && obj.attributes && obj.outerHTML);
      },
      equal: function (a, b) {
        return stringifyElement(a) === stringifyElement(b);
      },
      inspect: function (element, depth, output) {
        return output.code(stringifyElement(element), 'html');
      },
      diff: function (actual, expected, output, diff, inspect) {
        return diff(stringifyElement(actual), stringifyElement(expected));
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
