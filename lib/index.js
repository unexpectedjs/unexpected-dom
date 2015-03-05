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

function stringifyElement(elm) {
  var openTag = ['<' + elm.nodeName.toLowerCase()];
  var closeTag = '</' + elm.nodeName.toLowerCase() + '>';
  var attrs = getCanonicalAttributes(elm);

  openTag.push(Object.keys(attrs).map(function (key) {
    if (typeof attrs[key] === 'boolean') {
      return key;
    } else {
      return key + '="' + attrs[key] + '"';
    }
  }).join(' '));

  if (elm.children.length) {
    return openTag.join(' ') + '>...' + closeTag;
  } else {
    return openTag.join(' ') + '/>';
  }
}

module.exports = {
  name: 'unexpected-dom',
  installInto: function (expect) {

    expect.addType({
      name: 'DOMNode',
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
      name: 'HTMLElement',
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

    expect.addAssertion('HTMLElement', ['to [only] have (attribute|attributes)'], function (expect, subject, cmp) {
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
  }
};
