(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
      name: 'HTMLDocType',
      base: 'DOMNode',
      identify: function (obj) {
        return obj && obj.nodeType === 10 && 'publicId' in obj;
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
        return obj && obj.nodeType === 9 && obj.documentElement && obj.implementation;
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
        return obj && obj.nodeType === 1 && obj.nodeName && obj.attributes && obj.outerHTML;
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
      if (this.flags.first) {
        queryResult = subject.querySelector(value);
        if (!queryResult) {
          this.errorMode = 'nested';
          expect.fail(function (output) {
            output.error('The selector').sp().jsString(value).sp().error('yielded no results');
          });
        }
      } else {
        queryResult = subject.querySelectorAll(value);
        if (queryResult.length === 0) {
          this.errorMode = 'nested';
          expect.fail(function (output) {
            output.error('The selector').sp().jsString(value).sp().error('yielded no results');
          });
        }
      }
      this.shift(expect, queryResult, 1);
    });
  }
};

},{"array-changes":2,"extend":4}],2:[function(require,module,exports){
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
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	'use strict';
	if (!obj || toString.call(obj) !== '[object Object]') {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	'use strict';
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXJyYXktY2hhbmdlcy9saWIvYXJyYXlDaGFuZ2VzLmpzIiwibm9kZV9tb2R1bGVzL2FycmF5LWNoYW5nZXMvbm9kZV9tb2R1bGVzL2FycmF5ZGlmZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBhcnJheUNoYW5nZXMgPSByZXF1aXJlKCdhcnJheS1jaGFuZ2VzJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyk7XG5cbi8vIEZyb20gaHRtbC1taW5pZmllclxudmFyIGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXMgPSB7XG4gIGRyYWdnYWJsZTogWyd0cnVlJywgJ2ZhbHNlJ10gLy8gZGVmYXVsdHMgdG8gJ2F1dG8nXG59O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSkge1xuICB2YXIgaXNTaW1wbGVCb29sZWFuID0gKC9eKD86YWxsb3dmdWxsc2NyZWVufGFzeW5jfGF1dG9mb2N1c3xhdXRvcGxheXxjaGVja2VkfGNvbXBhY3R8Y29udHJvbHN8ZGVjbGFyZXxkZWZhdWx0fGRlZmF1bHRjaGVja2VkfGRlZmF1bHRtdXRlZHxkZWZhdWx0c2VsZWN0ZWR8ZGVmZXJ8ZGlzYWJsZWR8ZW5hYmxlZHxmb3Jtbm92YWxpZGF0ZXxoaWRkZW58aW5kZXRlcm1pbmF0ZXxpbmVydHxpc21hcHxpdGVtc2NvcGV8bG9vcHxtdWx0aXBsZXxtdXRlZHxub2hyZWZ8bm9yZXNpemV8bm9zaGFkZXxub3ZhbGlkYXRlfG5vd3JhcHxvcGVufHBhdXNlb25leGl0fHJlYWRvbmx5fHJlcXVpcmVkfHJldmVyc2VkfHNjb3BlZHxzZWFtbGVzc3xzZWxlY3RlZHxzb3J0YWJsZXxzcGVsbGNoZWNrfHRydWVzcGVlZHx0eXBlbXVzdG1hdGNofHZpc2libGUpJC9pKS50ZXN0KGF0dHJOYW1lKTtcbiAgaWYgKGlzU2ltcGxlQm9vbGVhbikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGF0dHJWYWx1ZUVudW1lcmF0aW9uID0gZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlc1thdHRyTmFtZS50b0xvd2VyQ2FzZSgpXTtcbiAgaWYgKCFhdHRyVmFsdWVFbnVtZXJhdGlvbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBlbHNlIHtcbiAgICByZXR1cm4gKC0xID09PSBhdHRyVmFsdWVFbnVtZXJhdGlvbi5pbmRleE9mKGF0dHJWYWx1ZS50b0xvd2VyQ2FzZSgpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXR0cmlidXRlcyhlbGVtZW50KSB7XG4gIHZhciBhdHRycyA9IGVsZW1lbnQuYXR0cmlidXRlcztcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBpZiAoYXR0cnNbaV0ubmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gYXR0cnNbaV0udmFsdWUgJiYgYXR0cnNbaV0udmFsdWUuc3BsaXQoJyAnKSB8fCBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2F0dHJzW2ldLm5hbWVdID0gaXNCb29sZWFuQXR0cmlidXRlKGF0dHJzW2ldLm5hbWUpID8gdHJ1ZSA6IChhdHRyc1tpXS52YWx1ZSB8fCAnJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZ2V0Q2Fub25pY2FsQXR0cmlidXRlcyhlbGVtZW50KSB7XG4gIHZhciBhdHRycyA9IGdldEF0dHJpYnV0ZXMoZWxlbWVudCk7XG4gIHZhciByZXN1bHQgPSB7fTtcblxuICBPYmplY3Qua2V5cyhhdHRycykuc29ydCgpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHJlc3VsdFtrZXldID0gYXR0cnNba2V5XTtcbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaXNWb2lkRWxlbWVudChlbGVtZW50TmFtZSkge1xuICByZXR1cm4gKC8oPzphcmVhfGJhc2V8YnJ8Y29sfGVtYmVkfGhyfGltZ3xpbnB1dHxrZXlnZW58bGlua3xtZW51aXRlbXxtZXRhfHBhcmFtfHNvdXJjZXx0cmFja3x3YnIpL2kpLnRlc3QoZWxlbWVudE5hbWUpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbiAgdmFyIHN0ciA9ICc8JyArIGVsZW1lbnROYW1lO1xuICB2YXIgYXR0cnMgPSBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpO1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAoaXNCb29sZWFuQXR0cmlidXRlKGtleSkpIHtcbiAgICAgIHN0ciArPSAnICcgKyBrZXk7XG4gICAgfSBlbHNlIGlmIChrZXkgPT09ICdjbGFzcycpIHtcbiAgICAgIHN0ciArPSAnIGNsYXNzPVwiJyArIGF0dHJzW2tleV0uam9pbignICcpICsgJ1wiJztcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGtleSArICc9XCInICsgYXR0cnNba2V5XS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKSArICdcIic7XG4gICAgfVxuICB9KTtcblxuICBzdHIgKz0gJz4nO1xuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlFbmRUYWcoZWxlbWVudCkge1xuICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChpc1ZvaWRFbGVtZW50KGVsZW1lbnROYW1lKSAmJiBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICcnO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAnPC8nICsgZWxlbWVudE5hbWUgKyAnPic7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGlmZk5vZGVMaXN0cyhhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gIHZhciBjaGFuZ2VzID0gYXJyYXlDaGFuZ2VzKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFjdHVhbCksIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGV4cGVjdGVkKSwgZXF1YWwsIGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgLy8gRmlndXJlIG91dCB3aGV0aGVyIGEgYW5kIGIgYXJlIFwic3RydXR1cmFsbHkgc2ltaWxhclwiIHNvIHRoZXkgY2FuIGJlIGRpZmZlZCBpbmxpbmUuXG4gICAgcmV0dXJuIChcbiAgICAgIGEubm9kZVR5cGUgPT09IDEgJiYgYi5ub2RlVHlwZSA9PT0gMSAmJlxuICAgICAgYS5ub2RlTmFtZSA9PT0gYi5ub2RlTmFtZVxuICAgICk7XG4gIH0pO1xuXG4gIGNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0sIGluZGV4KSB7XG4gICAgb3V0cHV0LmkoKS5ibG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgdHlwZSA9IGRpZmZJdGVtLnR5cGU7XG4gICAgICBpZiAodHlwZSA9PT0gJ2luc2VydCcpIHtcbiAgICAgICAgdGhpcy5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ21pc3NpbmcgJykuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKS5zcCgpLmVycm9yKCcvLyBzaG91bGQgYmUgcmVtb3ZlZCcpKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2VxdWFsJykge1xuICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciB2YWx1ZURpZmYgPSBkaWZmKGRpZmZJdGVtLnZhbHVlLCBkaWZmSXRlbS5leHBlY3RlZCk7XG4gICAgICAgIGlmICh2YWx1ZURpZmYgJiYgdmFsdWVEaWZmLmlubGluZSkge1xuICAgICAgICAgIHRoaXMuYmxvY2sodmFsdWVEaWZmLmRpZmYpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlRGlmZikge1xuICAgICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkuc3AoKSkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuc2hvdWxkRXF1YWxFcnJvcihkaWZmSXRlbS5leHBlY3RlZCwgaW5zcGVjdCkubmwoKS5hcHBlbmQodmFsdWVEaWZmLmRpZmYpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkuc3AoKSkuYW5ub3RhdGlvbkJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuc2hvdWxkRXF1YWxFcnJvcihkaWZmSXRlbS5leHBlY3RlZCwgaW5zcGVjdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KS5ubChpbmRleCA8IGNoYW5nZXMubGVuZ3RoIC0gMSA/IDEgOiAwKTtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBuYW1lOiAndW5leHBlY3RlZC1kb20nLFxuICBpbnN0YWxsSW50bzogZnVuY3Rpb24gKGV4cGVjdCkge1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTU5vZGUnLFxuICAgICAgYmFzZTogJ29iamVjdCcsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlTmFtZSAmJiBbMiwgMywgNCwgNSwgNiwgNywgMTAsIDExLCAxMl0uaW5kZXhPZihvYmoubm9kZVR5cGUpID4gLTE7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVsZW1lbnQubm9kZU5hbWUgKyAnIFwiJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJ1wiJywgJ3ByaXNtLXN0cmluZycpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTUNvbW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDg7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWU7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKCc8IS0tJyArIGVsZW1lbnQubm9kZVZhbHVlICsgJy0tPicsICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IS0tJyArIGFjdHVhbC5ub2RlVmFsdWUgKyAnLS0+JywgJzwhLS0nICsgZXhwZWN0ZWQubm9kZVZhbHVlICsgJy0tPicpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0RPTVRleHROb2RlJyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVUeXBlID09PSAzO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5ub2RlVmFsdWUudHJpbSgpID09PSBiLm5vZGVWYWx1ZS50cmltKCk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC5jb2RlKGVsZW1lbnQubm9kZVZhbHVlLnRyaW0oKS5yZXBsYWNlKC88L2csICcmbHQ7JyksICdodG1sJyk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKGFjdHVhbC5ub2RlVmFsdWUsIGV4cGVjdGVkLm5vZGVWYWx1ZSk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NTm9kZUxpc3QnLFxuICAgICAgYmFzZTogJ2FycmF5LWxpa2UnLFxuICAgICAgcHJlZml4OiBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnTm9kZUxpc3RbJyk7XG4gICAgICB9LFxuICAgICAgc3VmZml4OiBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnXScpO1xuICAgICAgfSxcbiAgICAgIGRlbGltaXRlcjogZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LnRleHQoJ2RlbGltaXRlcicpO1xuICAgICAgfSxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgb2JqICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5sZW5ndGggPT09ICdudW1iZXInICYmXG4gICAgICAgICAgdHlwZW9mIG9iai50b1N0cmluZyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIHR5cGVvZiBvYmouaXRlbSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIG9iai50b1N0cmluZygpLmluZGV4T2YoJ05vZGVMaXN0JykgIT09IC0xXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnSFRNTERvY1R5cGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEwICYmICdwdWJsaWNJZCcgaW4gb2JqO1xuICAgICAgfSxcbiAgICAgIGluc3BlY3Q6IGZ1bmN0aW9uIChkb2N0eXBlLCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIG91dHB1dC5jb2RlKCc8IURPQ1RZUEUgJyArIGRvY3R5cGUubmFtZSArICc+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpO1xuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYpIHtcbiAgICAgICAgdmFyIGQgPSBkaWZmKCc8IURPQ1RZUEUgJyArIGFjdHVhbC5uYW1lICsgJz4nLCAnPCFET0NUWVBFICcgKyBleHBlY3RlZC5uYW1lICsgJz4nKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRG9jdW1lbnQnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDkgJiYgb2JqLmRvY3VtZW50RWxlbWVudCAmJiBvYmouaW1wbGVtZW50YXRpb247XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3VtZW50LCBkZXB0aCwgb3V0cHV0LCBpbnNwZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRvY3VtZW50LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0KGRvY3VtZW50LmNoaWxkTm9kZXNbaV0pKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgIGRpZmY6IG91dHB1dFxuICAgICAgICB9O1xuICAgICAgICBkaWZmTm9kZUxpc3RzKGFjdHVhbC5jaGlsZE5vZGVzLCBleHBlY3RlZC5jaGlsZE5vZGVzLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRWxlbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMSAmJiBvYmoubm9kZU5hbWUgJiYgb2JqLmF0dHJpYnV0ZXMgJiYgb2JqLm91dGVySFRNTDtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIsIGVxdWFsKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGIubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAmJiBlcXVhbChnZXRBdHRyaWJ1dGVzKGEpLCBnZXRBdHRyaWJ1dGVzKGIpKSAmJiBlcXVhbChhLmNoaWxkTm9kZXMsIGIuY2hpbGROb2Rlcyk7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGVsZW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgdmFyIGVsZW1lbnROYW1lID0gZWxlbWVudC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgc3RhcnRUYWcgPSBzdHJpbmdpZnlTdGFydFRhZyhlbGVtZW50KTtcblxuICAgICAgICB2YXIgaW5zcGVjdGVkQ2hpbGRyZW4gPSBbXTtcbiAgICAgICAgaWYgKGVsZW1lbnROYW1lID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgIHZhciB0eXBlID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKTtcbiAgICAgICAgICBpZiAoIXR5cGUgfHwgL2phdmFzY3JpcHQvLnRlc3QodHlwZSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnamF2YXNjcmlwdCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCB0eXBlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKG91dHB1dC5jbG9uZSgpLmNvZGUoZWxlbWVudC50ZXh0Q29udGVudCwgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKSB8fCAndGV4dC9jc3MnKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChpbnNwZWN0KGVsZW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3aWR0aCA9IDA7XG4gICAgICAgIHZhciBtdWx0aXBsZUxpbmVzID0gaW5zcGVjdGVkQ2hpbGRyZW4uc29tZShmdW5jdGlvbiAobykge1xuICAgICAgICAgIHZhciBzaXplID0gby5zaXplKCk7XG4gICAgICAgICAgd2lkdGggKz0gc2l6ZS53aWR0aDtcbiAgICAgICAgICByZXR1cm4gd2lkdGggPiA1MCB8fCBvLmhlaWdodCA+IDE7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG91dHB1dC5jb2RlKHN0YXJ0VGFnLCAnaHRtbCcpO1xuICAgICAgICBpZiAoZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgIGlmIChtdWx0aXBsZUxpbmVzKSB7XG4gICAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuXG4gICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmkoKS5ibG9jayhpbnNwZWN0ZWRDaGlsZCkubmwoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBvdXRwdXQub3V0ZGVudExpbmVzKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3RlZENoaWxkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoZWxlbWVudCksICdodG1sJyk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9LFxuICAgICAgZGlmZkxpbWl0OiA1MTIsXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgICAgIGRpZmY6IG91dHB1dCxcbiAgICAgICAgICBpbmxpbmU6IHRydWVcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKSA+IHRoaXMuZGlmZkxpbWl0KSB7XG4gICAgICAgICAgcmVzdWx0LmRpZmYuanNDb21tZW50KCdEaWZmIHN1cHByZXNzZWQgZHVlIHRvIHNpemUgPiAnICsgdGhpcy5kaWZmTGltaXQpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZW1wdHlFbGVtZW50cyA9IGFjdHVhbC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMCAmJiBleHBlY3RlZC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgdmFyIGNvbmZsaWN0aW5nRWxlbWVudCA9IGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICE9PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpIHx8ICFlcXVhbChnZXRBdHRyaWJ1dGVzKGFjdHVhbCksIGdldEF0dHJpYnV0ZXMoZXhwZWN0ZWQpKTtcblxuICAgICAgICBpZiAoIWNvbmZsaWN0aW5nRWxlbWVudCkge1xuICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeVN0YXJ0VGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWVtcHR5RWxlbWVudHMpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGRpZmYoc3RyaW5naWZ5U3RhcnRUYWcoYWN0dWFsKSwgc3RyaW5naWZ5U3RhcnRUYWcoZXhwZWN0ZWQpKS5kaWZmKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW1wdHlFbGVtZW50cykge1xuICAgICAgICAgIG91dHB1dC5ubCgpLmluZGVudExpbmVzKCk7XG4gICAgICAgICAgZGlmZk5vZGVMaXN0cyhhY3R1YWwuY2hpbGROb2RlcywgZXhwZWN0ZWQuY2hpbGROb2Rlcywgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCk7XG4gICAgICAgICAgb3V0cHV0Lm5sKCkub3V0ZGVudExpbmVzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW1wdHlFbGVtZW50cyAmJiBjb25mbGljdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGRpZmYoc3RyaW5naWZ5U3RhcnRUYWcoYWN0dWFsKSArIHN0cmluZ2lmeUVuZFRhZyhhY3R1YWwpLCBzdHJpbmdpZnlTdGFydFRhZyhleHBlY3RlZCkgKyBzdHJpbmdpZnlFbmRUYWcoZXhwZWN0ZWQpKS5kaWZmKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoYWN0dWFsLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhhY3R1YWwpLCAnaHRtbCcpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvdXRwdXQuYXBwZW5kKGRpZmYoc3RyaW5naWZ5RW5kVGFnKGFjdHVhbCksIHN0cmluZ2lmeUVuZFRhZyhleHBlY3RlZCkpLmRpZmYpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdIVE1MRWxlbWVudCcsICd0byBbb25seV0gaGF2ZSAoYXR0cmlidXRlfGF0dHJpYnV0ZXMpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgY21wKSB7XG4gICAgICB2YXIgYXR0cnMgPSBnZXRBdHRyaWJ1dGVzKHN1YmplY3QpO1xuICAgICAgdmFyIGNtcENsYXNzZXM7XG5cbiAgICAgIGlmICh0eXBlb2YgY21wID09PSAnc3RyaW5nJykge1xuICAgICAgICBjbXAgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShjbXApKSB7XG4gICAgICAgIGV4cGVjdChhdHRycywgJ3RvIFtvbmx5XSBoYXZlIGtleXMnLCBjbXApO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY21wID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLmZsYWdzLmV4aGF1c3RpdmVseSA9IHRoaXMuZmxhZ3Mub25seTtcblxuICAgICAgICB2YXIgY29tcGFyYXRvciA9IGV4dGVuZCh7fSwgY21wKTtcblxuICAgICAgICBpZiAoY21wWydjbGFzcyddKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBjbXBbJ2NsYXNzJ10gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjbXBDbGFzc2VzID0gY21wWydjbGFzcyddLnNwbGl0KCcgJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNtcENsYXNzZXMgPSBjbXBbJ2NsYXNzJ107XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZmxhZ3MuZXhoYXVzdGl2ZWx5KSB7XG4gICAgICAgICAgaWYgKGNtcFsnY2xhc3MnXSkge1xuICAgICAgICAgICAgdmFyIGNtcENsYXNzZXNDb3B5ID0gY21wQ2xhc3Nlcy5zbGljZSgpO1xuICAgICAgICAgICAgY21wQ2xhc3NlcyA9IFtdO1xuICAgICAgICAgICAgYXR0cnNbJ2NsYXNzJ10uZm9yRWFjaChmdW5jdGlvbiAoY2xhc3NOYW1lKSB7XG4gICAgICAgICAgICAgIHZhciBpZHggPSBjbXBDbGFzc2VzQ29weS5pbmRleE9mKGNsYXNzTmFtZSk7XG5cbiAgICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBjbXBDbGFzc2VzLnB1c2goY21wQ2xhc3Nlc0NvcHkuc3BsaWNlKGlkeCwgMSlbMF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY21wQ2xhc3NlcyA9IGNtcENsYXNzZXMuY29uY2F0KGNtcENsYXNzZXNDb3B5KTtcblxuICAgICAgICAgICAgaWYgKGNtcFsnY2xhc3MnXSkge1xuICAgICAgICAgICAgICBjb21wYXJhdG9yWydjbGFzcyddID0gY21wQ2xhc3NlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gZXhwZWN0KGF0dHJzLCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGNvbXBhcmF0b3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChjbXBbJ2NsYXNzJ10pIHtcbiAgICAgICAgICAgIGNvbXBhcmF0b3JbJ2NsYXNzJ10gPSBleHBlY3QuaXQuYXBwbHkobnVsbCwgWyd0byBjb250YWluJ10uY29uY2F0KGNtcENsYXNzZXMpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gZXhwZWN0KGF0dHJzLCAndG8gc2F0aXNmeScsIGNvbXBhcmF0b3IpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzdXBwbHkgZWl0aGVyIHN0cmluZ3MsIGFycmF5LCBvciBvYmplY3QnKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0hUTUxFbGVtZW50JywgJ3RvIGhhdmUgW25vXSAoY2hpbGR8Y2hpbGRyZW4pJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgcXVlcnksIGNtcCkge1xuICAgICAgaWYgKHRoaXMuZmxhZ3Mubm8pIHtcbiAgICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgcmV0dXJuIGV4cGVjdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdWJqZWN0LmNoaWxkTm9kZXMpLCAndG8gYmUgYW4gZW1wdHkgYXJyYXknKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHN1YmplY3QucXVlcnlTZWxlY3RvckFsbChxdWVyeSkpO1xuICAgICAgICB0aHJvdyBjaGlsZHJlbjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0hUTUxFbGVtZW50JywgJ3RvIGhhdmUgdGV4dCcsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gZXhwZWN0KHN1YmplY3QudGV4dENvbnRlbnQsICd0byBzYXRpc2Z5JywgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbihbJ0hUTUxEb2N1bWVudCcsICdIVE1MRWxlbWVudCddLCAncXVlcmllZCBmb3IgW2ZpcnN0XScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHZhbHVlKSB7XG4gICAgICB2YXIgcXVlcnlSZXN1bHQ7XG4gICAgICBpZiAodGhpcy5mbGFncy5maXJzdCkge1xuICAgICAgICBxdWVyeVJlc3VsdCA9IHN1YmplY3QucXVlcnlTZWxlY3Rvcih2YWx1ZSk7XG4gICAgICAgIGlmICghcXVlcnlSZXN1bHQpIHtcbiAgICAgICAgICB0aGlzLmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgICAgIGV4cGVjdC5mYWlsKGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dC5lcnJvcignVGhlIHNlbGVjdG9yJykuc3AoKS5qc1N0cmluZyh2YWx1ZSkuc3AoKS5lcnJvcigneWllbGRlZCBubyByZXN1bHRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHZhbHVlKTtcbiAgICAgICAgaWYgKHF1ZXJ5UmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgb3V0cHV0LmVycm9yKCdUaGUgc2VsZWN0b3InKS5zcCgpLmpzU3RyaW5nKHZhbHVlKS5zcCgpLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5zaGlmdChleHBlY3QsIHF1ZXJ5UmVzdWx0LCAxKTtcbiAgICB9KTtcbiAgfVxufTtcbiIsInZhciBhcnJheURpZmYgPSByZXF1aXJlKCdhcnJheWRpZmYnKTtcblxuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCkge1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhcnJheUNoYW5nZXMoYWN0dWFsLCBleHBlY3RlZCwgZXF1YWwsIHNpbWlsYXIpIHtcbiAgICB2YXIgbXV0YXRlZEFycmF5ID0gbmV3IEFycmF5KGFjdHVhbC5sZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBhY3R1YWwubGVuZ3RoOyBrICs9IDEpIHtcbiAgICAgICAgbXV0YXRlZEFycmF5W2tdID0ge1xuICAgICAgICAgICAgdHlwZTogJ3NpbWlsYXInLFxuICAgICAgICAgICAgdmFsdWU6IGFjdHVhbFtrXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmIChtdXRhdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICBtdXRhdGVkQXJyYXlbbXV0YXRlZEFycmF5Lmxlbmd0aCAtIDFdLmxhc3QgPSB0cnVlO1xuICAgIH1cblxuICAgIHNpbWlsYXIgPSBzaW1pbGFyIHx8IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgdmFyIGl0ZW1zRGlmZiA9IGFycmF5RGlmZihhY3R1YWwsIGV4cGVjdGVkLCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gZXF1YWwoYSwgYikgfHwgc2ltaWxhcihhLCBiKTtcbiAgICB9KTtcblxuICAgIHZhciByZW1vdmVUYWJsZSA9IFtdO1xuICAgIGZ1bmN0aW9uIG9mZnNldEluZGV4KGluZGV4KSB7XG4gICAgICAgIHJldHVybiBpbmRleCArIChyZW1vdmVUYWJsZVtpbmRleCAtIDFdIHx8IDApO1xuICAgIH1cblxuICAgIHZhciByZW1vdmVzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdyZW1vdmUnO1xuICAgIH0pO1xuXG4gICAgdmFyIHJlbW92ZXNCeUluZGV4ID0ge307XG4gICAgdmFyIHJlbW92ZWRJdGVtcyA9IDA7XG4gICAgcmVtb3Zlcy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgcmVtb3ZlSW5kZXggPSByZW1vdmVkSXRlbXMgKyBkaWZmSXRlbS5pbmRleDtcbiAgICAgICAgbXV0YXRlZEFycmF5LnNsaWNlKHJlbW92ZUluZGV4LCBkaWZmSXRlbS5ob3dNYW55ICsgcmVtb3ZlSW5kZXgpLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHYudHlwZSA9ICdyZW1vdmUnO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVtb3ZlZEl0ZW1zICs9IGRpZmZJdGVtLmhvd01hbnk7XG4gICAgICAgIHJlbW92ZXNCeUluZGV4W2RpZmZJdGVtLmluZGV4XSA9IHJlbW92ZWRJdGVtcztcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZVJlbW92ZVRhYmxlKCkge1xuICAgICAgICByZW1vdmVkSXRlbXMgPSAwO1xuICAgICAgICBhY3R1YWwuZm9yRWFjaChmdW5jdGlvbiAoXywgaW5kZXgpIHtcbiAgICAgICAgICAgIHJlbW92ZWRJdGVtcyArPSByZW1vdmVzQnlJbmRleFtpbmRleF0gfHwgMDtcbiAgICAgICAgICAgIHJlbW92ZVRhYmxlW2luZGV4XSA9IHJlbW92ZWRJdGVtcztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdXBkYXRlUmVtb3ZlVGFibGUoKTtcblxuICAgIHZhciBtb3ZlcyA9IGl0ZW1zRGlmZi5maWx0ZXIoZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHJldHVybiBkaWZmSXRlbS50eXBlID09PSAnbW92ZSc7XG4gICAgfSk7XG5cbiAgICB2YXIgbW92ZWRJdGVtcyA9IDA7XG4gICAgbW92ZXMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgdmFyIG1vdmVGcm9tSW5kZXggPSBvZmZzZXRJbmRleChkaWZmSXRlbS5mcm9tKTtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSBtdXRhdGVkQXJyYXkuc2xpY2UobW92ZUZyb21JbmRleCwgZGlmZkl0ZW0uaG93TWFueSArIG1vdmVGcm9tSW5kZXgpO1xuICAgICAgICB2YXIgYWRkZWQgPSByZW1vdmVkLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgcmV0dXJuIGV4dGVuZCh7fSwgdiwgeyBsYXN0OiBmYWxzZSwgdHlwZTogJ2luc2VydCcgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHYudHlwZSA9ICdyZW1vdmUnO1xuICAgICAgICB9KTtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShtdXRhdGVkQXJyYXksIFtvZmZzZXRJbmRleChkaWZmSXRlbS50byksIDBdLmNvbmNhdChhZGRlZCkpO1xuICAgICAgICBtb3ZlZEl0ZW1zICs9IGRpZmZJdGVtLmhvd01hbnk7XG4gICAgICAgIHJlbW92ZXNCeUluZGV4W2RpZmZJdGVtLmZyb21dID0gbW92ZWRJdGVtcztcbiAgICAgICAgdXBkYXRlUmVtb3ZlVGFibGUoKTtcbiAgICB9KTtcblxuICAgIHZhciBpbnNlcnRzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdpbnNlcnQnO1xuICAgIH0pO1xuXG4gICAgaW5zZXJ0cy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgYWRkZWQgPSBuZXcgQXJyYXkoZGlmZkl0ZW0udmFsdWVzLmxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRpZmZJdGVtLnZhbHVlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGFkZGVkW2ldID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBkaWZmSXRlbS52YWx1ZXNbaV1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShtdXRhdGVkQXJyYXksIFtvZmZzZXRJbmRleChkaWZmSXRlbS5pbmRleCksIDBdLmNvbmNhdChhZGRlZCkpO1xuICAgIH0pO1xuXG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgbXV0YXRlZEFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtLCBpbmRleCkge1xuICAgICAgICB2YXIgdHlwZSA9IGRpZmZJdGVtLnR5cGU7XG4gICAgICAgIGlmICh0eXBlID09PSAncmVtb3ZlJykge1xuICAgICAgICAgICAgb2Zmc2V0IC09IDE7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3NpbWlsYXInKSB7XG4gICAgICAgICAgICBkaWZmSXRlbS5leHBlY3RlZCA9IGV4cGVjdGVkW29mZnNldCArIGluZGV4XTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIGNvbmZsaWN0cyA9IG11dGF0ZWRBcnJheS5yZWR1Y2UoZnVuY3Rpb24gKGNvbmZsaWN0cywgaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS50eXBlID09PSAnc2ltaWxhcicgPyBjb25mbGljdHMgOiBjb25mbGljdHMgKyAxO1xuICAgIH0sIDApO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGMgPSAwOyBpIDwgTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKSAmJiAgYyA8PSBjb25mbGljdHM7IGkgKz0gMSkge1xuICAgICAgICB2YXIgZXhwZWN0ZWRUeXBlID0gdHlwZW9mIGV4cGVjdGVkW2ldO1xuICAgICAgICB2YXIgYWN0dWFsVHlwZSA9IHR5cGVvZiBhY3R1YWxbaV07XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgYWN0dWFsVHlwZSAhPT0gZXhwZWN0ZWRUeXBlIHx8XG4gICAgICAgICAgICAgICAgKChhY3R1YWxUeXBlID09PSAnb2JqZWN0JyB8fCBhY3R1YWxUeXBlID09PSAnc3RyaW5nJykgJiYgIXNpbWlsYXIoYWN0dWFsW2ldLCBleHBlY3RlZFtpXSkpIHx8XG4gICAgICAgICAgICAgICAgKGFjdHVhbFR5cGUgIT09ICdvYmplY3QnICYmIGFjdHVhbFR5cGUgIT09ICdzdHJpbmcnICYmICFlcXVhbChhY3R1YWxbaV0sIGV4cGVjdGVkW2ldKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBjICs9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYyA8PSBjb25mbGljdHMpIHtcbiAgICAgICAgbXV0YXRlZEFycmF5ID0gW107XG4gICAgICAgIHZhciBqO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgTWF0aC5taW4oYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTsgaiArPSAxKSB7XG4gICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3NpbWlsYXInLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxbal0sXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkW2pdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhY3R1YWwubGVuZ3RoIDwgZXhwZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKDsgaiA8IE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBleHBlY3RlZFtqXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICg7IGogPCBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpOyBqICs9IDEpIHtcbiAgICAgICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogYWN0dWFsW2pdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG11dGF0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBtdXRhdGVkQXJyYXlbbXV0YXRlZEFycmF5Lmxlbmd0aCAtIDFdLmxhc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbXV0YXRlZEFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIGlmIChkaWZmSXRlbS50eXBlID09PSAnc2ltaWxhcicgJiYgZXF1YWwoZGlmZkl0ZW0udmFsdWUsIGRpZmZJdGVtLmV4cGVjdGVkKSkge1xuICAgICAgICAgICAgZGlmZkl0ZW0udHlwZSA9ICdlcXVhbCc7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtdXRhdGVkQXJyYXk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBhcnJheURpZmY7XG5cbi8vIEJhc2VkIG9uIHNvbWUgcm91Z2ggYmVuY2htYXJraW5nLCB0aGlzIGFsZ29yaXRobSBpcyBhYm91dCBPKDJuKSB3b3JzdCBjYXNlLFxuLy8gYW5kIGl0IGNhbiBjb21wdXRlIGRpZmZzIG9uIHJhbmRvbSBhcnJheXMgb2YgbGVuZ3RoIDEwMjQgaW4gYWJvdXQgMzRtcyxcbi8vIHRob3VnaCBqdXN0IGEgZmV3IGNoYW5nZXMgb24gYW4gYXJyYXkgb2YgbGVuZ3RoIDEwMjQgdGFrZXMgYWJvdXQgMC41bXNcblxuYXJyYXlEaWZmLkluc2VydERpZmYgPSBJbnNlcnREaWZmO1xuYXJyYXlEaWZmLlJlbW92ZURpZmYgPSBSZW1vdmVEaWZmO1xuYXJyYXlEaWZmLk1vdmVEaWZmID0gTW92ZURpZmY7XG5cbmZ1bmN0aW9uIEluc2VydERpZmYoaW5kZXgsIHZhbHVlcykge1xuICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gIHRoaXMudmFsdWVzID0gdmFsdWVzO1xufVxuSW5zZXJ0RGlmZi5wcm90b3R5cGUudHlwZSA9ICdpbnNlcnQnO1xuSW5zZXJ0RGlmZi5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogdGhpcy50eXBlXG4gICwgaW5kZXg6IHRoaXMuaW5kZXhcbiAgLCB2YWx1ZXM6IHRoaXMudmFsdWVzXG4gIH07XG59O1xuXG5mdW5jdGlvbiBSZW1vdmVEaWZmKGluZGV4LCBob3dNYW55KSB7XG4gIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgdGhpcy5ob3dNYW55ID0gaG93TWFueTtcbn1cblJlbW92ZURpZmYucHJvdG90eXBlLnR5cGUgPSAncmVtb3ZlJztcblJlbW92ZURpZmYucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IHRoaXMudHlwZVxuICAsIGluZGV4OiB0aGlzLmluZGV4XG4gICwgaG93TWFueTogdGhpcy5ob3dNYW55XG4gIH07XG59O1xuXG5mdW5jdGlvbiBNb3ZlRGlmZihmcm9tLCB0bywgaG93TWFueSkge1xuICB0aGlzLmZyb20gPSBmcm9tO1xuICB0aGlzLnRvID0gdG87XG4gIHRoaXMuaG93TWFueSA9IGhvd01hbnk7XG59XG5Nb3ZlRGlmZi5wcm90b3R5cGUudHlwZSA9ICdtb3ZlJztcbk1vdmVEaWZmLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiB0aGlzLnR5cGVcbiAgLCBmcm9tOiB0aGlzLmZyb21cbiAgLCB0bzogdGhpcy50b1xuICAsIGhvd01hbnk6IHRoaXMuaG93TWFueVxuICB9O1xufTtcblxuZnVuY3Rpb24gc3RyaWN0RXF1YWwoYSwgYikge1xuICByZXR1cm4gYSA9PT0gYjtcbn1cblxuZnVuY3Rpb24gYXJyYXlEaWZmKGJlZm9yZSwgYWZ0ZXIsIGVxdWFsRm4pIHtcbiAgaWYgKCFlcXVhbEZuKSBlcXVhbEZuID0gc3RyaWN0RXF1YWw7XG5cbiAgLy8gRmluZCBhbGwgaXRlbXMgaW4gYm90aCB0aGUgYmVmb3JlIGFuZCBhZnRlciBhcnJheSwgYW5kIHJlcHJlc2VudCB0aGVtXG4gIC8vIGFzIG1vdmVzLiBNYW55IG9mIHRoZXNlIFwibW92ZXNcIiBtYXkgZW5kIHVwIGJlaW5nIGRpc2NhcmRlZCBpbiB0aGUgbGFzdFxuICAvLyBwYXNzIGlmIHRoZXkgYXJlIGZyb20gYW4gaW5kZXggdG8gdGhlIHNhbWUgaW5kZXgsIGJ1dCB3ZSBkb24ndCBrbm93IHRoaXNcbiAgLy8gdXAgZnJvbnQsIHNpbmNlIHdlIGhhdmVuJ3QgeWV0IG9mZnNldCB0aGUgaW5kaWNlcy5cbiAgLy8gXG4gIC8vIEFsc28ga2VlcCBhIG1hcCBvZiBhbGwgdGhlIGluZGljaWVzIGFjY291bnRlZCBmb3IgaW4gdGhlIGJlZm9yZSBhbmQgYWZ0ZXJcbiAgLy8gYXJyYXlzLiBUaGVzZSBtYXBzIGFyZSB1c2VkIG5leHQgdG8gY3JlYXRlIGluc2VydCBhbmQgcmVtb3ZlIGRpZmZzLlxuICB2YXIgYmVmb3JlTGVuZ3RoID0gYmVmb3JlLmxlbmd0aDtcbiAgdmFyIGFmdGVyTGVuZ3RoID0gYWZ0ZXIubGVuZ3RoO1xuICB2YXIgbW92ZXMgPSBbXTtcbiAgdmFyIGJlZm9yZU1hcmtlZCA9IHt9O1xuICB2YXIgYWZ0ZXJNYXJrZWQgPSB7fTtcbiAgZm9yICh2YXIgYmVmb3JlSW5kZXggPSAwOyBiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aDsgYmVmb3JlSW5kZXgrKykge1xuICAgIHZhciBiZWZvcmVJdGVtID0gYmVmb3JlW2JlZm9yZUluZGV4XTtcbiAgICBmb3IgKHZhciBhZnRlckluZGV4ID0gMDsgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoOyBhZnRlckluZGV4KyspIHtcbiAgICAgIGlmIChhZnRlck1hcmtlZFthZnRlckluZGV4XSkgY29udGludWU7XG4gICAgICBpZiAoIWVxdWFsRm4oYmVmb3JlSXRlbSwgYWZ0ZXJbYWZ0ZXJJbmRleF0pKSBjb250aW51ZTtcbiAgICAgIHZhciBmcm9tID0gYmVmb3JlSW5kZXg7XG4gICAgICB2YXIgdG8gPSBhZnRlckluZGV4O1xuICAgICAgdmFyIGhvd01hbnkgPSAwO1xuICAgICAgZG8ge1xuICAgICAgICBiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXgrK10gPSBhZnRlck1hcmtlZFthZnRlckluZGV4KytdID0gdHJ1ZTtcbiAgICAgICAgaG93TWFueSsrO1xuICAgICAgfSB3aGlsZSAoXG4gICAgICAgIGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoICYmXG4gICAgICAgIGFmdGVySW5kZXggPCBhZnRlckxlbmd0aCAmJlxuICAgICAgICBlcXVhbEZuKGJlZm9yZVtiZWZvcmVJbmRleF0sIGFmdGVyW2FmdGVySW5kZXhdKSAmJlxuICAgICAgICAhYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF1cbiAgICAgICk7XG4gICAgICBtb3Zlcy5wdXNoKG5ldyBNb3ZlRGlmZihmcm9tLCB0bywgaG93TWFueSkpO1xuICAgICAgYmVmb3JlSW5kZXgtLTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIENyZWF0ZSBhIHJlbW92ZSBmb3IgYWxsIG9mIHRoZSBpdGVtcyBpbiB0aGUgYmVmb3JlIGFycmF5IHRoYXQgd2VyZVxuICAvLyBub3QgbWFya2VkIGFzIGJlaW5nIG1hdGNoZWQgaW4gdGhlIGFmdGVyIGFycmF5IGFzIHdlbGxcbiAgdmFyIHJlbW92ZXMgPSBbXTtcbiAgZm9yIChiZWZvcmVJbmRleCA9IDA7IGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoOykge1xuICAgIGlmIChiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXhdKSB7XG4gICAgICBiZWZvcmVJbmRleCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IGJlZm9yZUluZGV4O1xuICAgIHZhciBob3dNYW55ID0gMDtcbiAgICB3aGlsZSAoYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGggJiYgIWJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleCsrXSkge1xuICAgICAgaG93TWFueSsrO1xuICAgIH1cbiAgICByZW1vdmVzLnB1c2gobmV3IFJlbW92ZURpZmYoaW5kZXgsIGhvd01hbnkpKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSBhbiBpbnNlcnQgZm9yIGFsbCBvZiB0aGUgaXRlbXMgaW4gdGhlIGFmdGVyIGFycmF5IHRoYXQgd2VyZVxuICAvLyBub3QgbWFya2VkIGFzIGJlaW5nIG1hdGNoZWQgaW4gdGhlIGJlZm9yZSBhcnJheSBhcyB3ZWxsXG4gIHZhciBpbnNlcnRzID0gW107XG4gIGZvciAoYWZ0ZXJJbmRleCA9IDA7IGFmdGVySW5kZXggPCBhZnRlckxlbmd0aDspIHtcbiAgICBpZiAoYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF0pIHtcbiAgICAgIGFmdGVySW5kZXgrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YXIgaW5kZXggPSBhZnRlckluZGV4O1xuICAgIHZhciBob3dNYW55ID0gMDtcbiAgICB3aGlsZSAoYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoICYmICFhZnRlck1hcmtlZFthZnRlckluZGV4KytdKSB7XG4gICAgICBob3dNYW55Kys7XG4gICAgfVxuICAgIHZhciB2YWx1ZXMgPSBhZnRlci5zbGljZShpbmRleCwgaW5kZXggKyBob3dNYW55KTtcbiAgICBpbnNlcnRzLnB1c2gobmV3IEluc2VydERpZmYoaW5kZXgsIHZhbHVlcykpO1xuICB9XG5cbiAgdmFyIGluc2VydHNMZW5ndGggPSBpbnNlcnRzLmxlbmd0aDtcbiAgdmFyIHJlbW92ZXNMZW5ndGggPSByZW1vdmVzLmxlbmd0aDtcbiAgdmFyIG1vdmVzTGVuZ3RoID0gbW92ZXMubGVuZ3RoO1xuICB2YXIgaSwgajtcblxuICAvLyBPZmZzZXQgc3Vic2VxdWVudCByZW1vdmVzIGFuZCBtb3ZlcyBieSByZW1vdmVzXG4gIHZhciBjb3VudCA9IDA7XG4gIGZvciAoaSA9IDA7IGkgPCByZW1vdmVzTGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmVtb3ZlID0gcmVtb3Zlc1tpXTtcbiAgICByZW1vdmUuaW5kZXggLT0gY291bnQ7XG4gICAgY291bnQgKz0gcmVtb3ZlLmhvd01hbnk7XG4gICAgZm9yIChqID0gMDsgaiA8IG1vdmVzTGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBtb3ZlID0gbW92ZXNbal07XG4gICAgICBpZiAobW92ZS5mcm9tID49IHJlbW92ZS5pbmRleCkgbW92ZS5mcm9tIC09IHJlbW92ZS5ob3dNYW55O1xuICAgIH1cbiAgfVxuXG4gIC8vIE9mZnNldCBtb3ZlcyBieSBpbnNlcnRzXG4gIGZvciAoaSA9IGluc2VydHNMZW5ndGg7IGktLTspIHtcbiAgICB2YXIgaW5zZXJ0ID0gaW5zZXJ0c1tpXTtcbiAgICB2YXIgaG93TWFueSA9IGluc2VydC52YWx1ZXMubGVuZ3RoO1xuICAgIGZvciAoaiA9IG1vdmVzTGVuZ3RoOyBqLS07KSB7XG4gICAgICB2YXIgbW92ZSA9IG1vdmVzW2pdO1xuICAgICAgaWYgKG1vdmUudG8gPj0gaW5zZXJ0LmluZGV4KSBtb3ZlLnRvIC09IGhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT2Zmc2V0IHRoZSB0byBvZiBtb3ZlcyBieSBsYXRlciBtb3Zlc1xuICBmb3IgKGkgPSBtb3Zlc0xlbmd0aDsgaS0tID4gMTspIHtcbiAgICB2YXIgbW92ZSA9IG1vdmVzW2ldO1xuICAgIGlmIChtb3ZlLnRvID09PSBtb3ZlLmZyb20pIGNvbnRpbnVlO1xuICAgIGZvciAoaiA9IGk7IGotLTspIHtcbiAgICAgIHZhciBlYXJsaWVyID0gbW92ZXNbal07XG4gICAgICBpZiAoZWFybGllci50byA+PSBtb3ZlLnRvKSBlYXJsaWVyLnRvIC09IG1vdmUuaG93TWFueTtcbiAgICAgIGlmIChlYXJsaWVyLnRvID49IG1vdmUuZnJvbSkgZWFybGllci50byArPSBtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT25seSBvdXRwdXQgbW92ZXMgdGhhdCBlbmQgdXAgaGF2aW5nIGFuIGVmZmVjdCBhZnRlciBvZmZzZXR0aW5nXG4gIHZhciBvdXRwdXRNb3ZlcyA9IFtdO1xuXG4gIC8vIE9mZnNldCB0aGUgZnJvbSBvZiBtb3ZlcyBieSBlYXJsaWVyIG1vdmVzXG4gIGZvciAoaSA9IDA7IGkgPCBtb3Zlc0xlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG1vdmUgPSBtb3Zlc1tpXTtcbiAgICBpZiAobW92ZS50byA9PT0gbW92ZS5mcm9tKSBjb250aW51ZTtcbiAgICBvdXRwdXRNb3Zlcy5wdXNoKG1vdmUpO1xuICAgIGZvciAoaiA9IGkgKyAxOyBqIDwgbW92ZXNMZW5ndGg7IGorKykge1xuICAgICAgdmFyIGxhdGVyID0gbW92ZXNbal07XG4gICAgICBpZiAobGF0ZXIuZnJvbSA+PSBtb3ZlLmZyb20pIGxhdGVyLmZyb20gLT0gbW92ZS5ob3dNYW55O1xuICAgICAgaWYgKGxhdGVyLmZyb20gPj0gbW92ZS50bykgbGF0ZXIuZnJvbSArPSBtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlbW92ZXMuY29uY2F0KG91dHB1dE1vdmVzLCBpbnNlcnRzKTtcbn1cbiIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciB1bmRlZmluZWQ7XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuXHR2YXIgaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCA9IG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IucHJvdG90eXBlICYmIGhhc093bi5jYWxsKG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsICdpc1Byb3RvdHlwZU9mJyk7XG5cdC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3Rcblx0aWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7fVxuXG5cdHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHR2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG5cdFx0dGFyZ2V0ID0gYXJndW1lbnRzWzBdLFxuXHRcdGkgPSAxLFxuXHRcdGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG5cdFx0ZGVlcCA9IGZhbHNlO1xuXG5cdC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cblx0aWYgKHR5cGVvZiB0YXJnZXQgPT09ICdib29sZWFuJykge1xuXHRcdGRlZXAgPSB0YXJnZXQ7XG5cdFx0dGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuXHRcdC8vIHNraXAgdGhlIGJvb2xlYW4gYW5kIHRoZSB0YXJnZXRcblx0XHRpID0gMjtcblx0fSBlbHNlIGlmICgodHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcgJiYgdHlwZW9mIHRhcmdldCAhPT0gJ2Z1bmN0aW9uJykgfHwgdGFyZ2V0ID09IG51bGwpIHtcblx0XHR0YXJnZXQgPSB7fTtcblx0fVxuXG5cdGZvciAoOyBpIDwgbGVuZ3RoOyArK2kpIHtcblx0XHRvcHRpb25zID0gYXJndW1lbnRzW2ldO1xuXHRcdC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcblx0XHRpZiAob3B0aW9ucyAhPSBudWxsKSB7XG5cdFx0XHQvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG5cdFx0XHRmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuXHRcdFx0XHRzcmMgPSB0YXJnZXRbbmFtZV07XG5cdFx0XHRcdGNvcHkgPSBvcHRpb25zW25hbWVdO1xuXG5cdFx0XHRcdC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3Bcblx0XHRcdFx0aWYgKHRhcmdldCA9PT0gY29weSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG5cdFx0XHRcdGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG5cdFx0XHRcdFx0aWYgKGNvcHlJc0FycmF5KSB7XG5cdFx0XHRcdFx0XHRjb3B5SXNBcnJheSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgQXJyYXkuaXNBcnJheShzcmMpID8gc3JjIDogW107XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuXHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cblx0XHRcdFx0Ly8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNvcHkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGNvcHk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuXHRyZXR1cm4gdGFyZ2V0O1xufTtcblxuIl19
