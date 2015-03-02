function getAttributes(elm) {
  var attrs = elm.attributes;
  var result = {};

  for (var i = 0; i < attrs.length; i += 1) {
    result[attrs[i].name] = attrs[i].value;
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
    return key + '="' + attrs[key] + '"';
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
      name: 'HTMLElement',
      identify: function (obj) {
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
  }
};
