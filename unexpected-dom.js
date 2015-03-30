(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.unexpected || (g.unexpected = {})).dom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"array-changes":2}],2:[function(require,module,exports){
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

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXJyYXktY2hhbmdlcy9saWIvYXJyYXlDaGFuZ2VzLmpzIiwibm9kZV9tb2R1bGVzL2FycmF5LWNoYW5nZXMvbm9kZV9tb2R1bGVzL2FycmF5ZGlmZi9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgYXJyYXlDaGFuZ2VzID0gcmVxdWlyZSgnYXJyYXktY2hhbmdlcycpO1xuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIHJlc3VsdFthdHRyc1tpXS5uYW1lXSA9IGF0dHJzW2ldLnZhbHVlIHx8IHRydWU7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpc1ZvaWRFbGVtZW50KGVsZW1lbnROYW1lKSB7XG4gIHJldHVybiAoLyg/OmFyZWF8YmFzZXxicnxjb2x8ZW1iZWR8aHJ8aW1nfGlucHV0fGtleWdlbnxsaW5rfG1lbnVpdGVtfG1ldGF8cGFyYW18c291cmNlfHRyYWNrfHdicikvaSkudGVzdChlbGVtZW50TmFtZSk7XG59XG5cbi8vIEZyb20gaHRtbC1taW5pZmllclxudmFyIGVudW1lcmF0ZWRBdHRyaWJ1dGVWYWx1ZXMgPSB7XG4gIGRyYWdnYWJsZTogWyd0cnVlJywgJ2ZhbHNlJ10gLy8gZGVmYXVsdHMgdG8gJ2F1dG8nXG59O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSkge1xuICB2YXIgaXNTaW1wbGVCb29sZWFuID0gKC9eKD86YWxsb3dmdWxsc2NyZWVufGFzeW5jfGF1dG9mb2N1c3xhdXRvcGxheXxjaGVja2VkfGNvbXBhY3R8Y29udHJvbHN8ZGVjbGFyZXxkZWZhdWx0fGRlZmF1bHRjaGVja2VkfGRlZmF1bHRtdXRlZHxkZWZhdWx0c2VsZWN0ZWR8ZGVmZXJ8ZGlzYWJsZWR8ZW5hYmxlZHxmb3Jtbm92YWxpZGF0ZXxoaWRkZW58aW5kZXRlcm1pbmF0ZXxpbmVydHxpc21hcHxpdGVtc2NvcGV8bG9vcHxtdWx0aXBsZXxtdXRlZHxub2hyZWZ8bm9yZXNpemV8bm9zaGFkZXxub3ZhbGlkYXRlfG5vd3JhcHxvcGVufHBhdXNlb25leGl0fHJlYWRvbmx5fHJlcXVpcmVkfHJldmVyc2VkfHNjb3BlZHxzZWFtbGVzc3xzZWxlY3RlZHxzb3J0YWJsZXxzcGVsbGNoZWNrfHRydWVzcGVlZHx0eXBlbXVzdG1hdGNofHZpc2libGUpJC9pKS50ZXN0KGF0dHJOYW1lKTtcbiAgaWYgKGlzU2ltcGxlQm9vbGVhbikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGF0dHJWYWx1ZUVudW1lcmF0aW9uID0gZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlc1thdHRyTmFtZS50b0xvd2VyQ2FzZSgpXTtcbiAgaWYgKCFhdHRyVmFsdWVFbnVtZXJhdGlvbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBlbHNlIHtcbiAgICByZXR1cm4gKC0xID09PSBhdHRyVmFsdWVFbnVtZXJhdGlvbi5pbmRleE9mKGF0dHJWYWx1ZS50b0xvd2VyQ2FzZSgpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5U3RhcnRUYWcoZWxlbWVudCkge1xuICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gIHZhciBzdHIgPSAnPCcgKyBlbGVtZW50TmFtZTtcbiAgdmFyIGF0dHJzID0gZ2V0Q2Fub25pY2FsQXR0cmlidXRlcyhlbGVtZW50KTtcblxuICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKGlzQm9vbGVhbkF0dHJpYnV0ZShrZXkpKSB7XG4gICAgICBzdHIgKz0gJyAnICsga2V5O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsga2V5ICsgJz1cIicgKyBhdHRyc1trZXldLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpICsgJ1wiJztcbiAgICB9XG4gIH0pO1xuXG4gIHN0ciArPSAnPic7XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUVuZFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJyc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICc8LycgKyBlbGVtZW50TmFtZSArICc+JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkaWZmTm9kZUxpc3RzKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgdmFyIGNoYW5nZXMgPSBhcnJheUNoYW5nZXMoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYWN0dWFsKSwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZXhwZWN0ZWQpLCBlcXVhbCwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAvLyBGaWd1cmUgb3V0IHdoZXRoZXIgYSBhbmQgYiBhcmUgXCJzdHJ1dHVyYWxseSBzaW1pbGFyXCIgc28gdGhleSBjYW4gYmUgZGlmZmVkIGlubGluZS5cbiAgICByZXR1cm4gKFxuICAgICAgYS5ub2RlVHlwZSA9PT0gMSAmJiBiLm5vZGVUeXBlID09PSAxICYmXG4gICAgICBhLm5vZGVOYW1lID09PSBiLm5vZGVOYW1lXG4gICAgKTtcbiAgfSk7XG5cbiAgY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSwgaW5kZXgpIHtcbiAgICBvdXRwdXQuaSgpLmJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB0eXBlID0gZGlmZkl0ZW0udHlwZTtcbiAgICAgIGlmICh0eXBlID09PSAnaW5zZXJ0Jykge1xuICAgICAgICB0aGlzLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignbWlzc2luZyAnKS5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAncmVtb3ZlJykge1xuICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkuZXJyb3IoJy8vIHNob3VsZCBiZSByZW1vdmVkJykpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnZXF1YWwnKSB7XG4gICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHZhbHVlRGlmZiA9IGRpZmYoZGlmZkl0ZW0udmFsdWUsIGRpZmZJdGVtLmV4cGVjdGVkKTtcbiAgICAgICAgaWYgKHZhbHVlRGlmZiAmJiB2YWx1ZURpZmYuaW5saW5lKSB7XG4gICAgICAgICAgdGhpcy5ibG9jayh2YWx1ZURpZmYuZGlmZik7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWVEaWZmKSB7XG4gICAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKS5zcCgpKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5zaG91bGRFcXVhbEVycm9yKGRpZmZJdGVtLmV4cGVjdGVkLCBpbnNwZWN0KS5ubCgpLmFwcGVuZCh2YWx1ZURpZmYuZGlmZik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKS5zcCgpKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5zaG91bGRFcXVhbEVycm9yKGRpZmZJdGVtLmV4cGVjdGVkLCBpbnNwZWN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLm5sKGluZGV4IDwgY2hhbmdlcy5sZW5ndGggLSAxID8gMSA6IDApO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG5hbWU6ICd1bmV4cGVjdGVkLWRvbScsXG4gIGluc3RhbGxJbnRvOiBmdW5jdGlvbiAoZXhwZWN0KSB7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NTm9kZScsXG4gICAgICBiYXNlOiAnb2JqZWN0JyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVOYW1lICYmIFsyLCAzLCA0LCA1LCA2LCA3LCAxMCwgMTEsIDEyXS5pbmRleE9mKG9iai5ub2RlVHlwZSkgPiAtMTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoZWxlbWVudC5ub2RlTmFtZSArICcgXCInICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnXCInLCAncHJpc20tc3RyaW5nJyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NQ29tbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gODtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoJzwhLS0nICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnLS0+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgZCA9IGRpZmYoJzwhLS0nICsgYWN0dWFsLm5vZGVWYWx1ZSArICctLT4nLCAnPCEtLScgKyBleHBlY3RlZC5ub2RlVmFsdWUgKyAnLS0+Jyk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NVGV4dE5vZGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDM7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZS50cmltKCkgPT09IGIubm9kZVZhbHVlLnRyaW0oKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoZWxlbWVudC5ub2RlVmFsdWUudHJpbSgpLnJlcGxhY2UoLzwvZywgJyZsdDsnKSwgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgZCA9IGRpZmYoYWN0dWFsLm5vZGVWYWx1ZSwgZXhwZWN0ZWQubm9kZVZhbHVlKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlTGlzdCcsXG4gICAgICBiYXNlOiAnYXJyYXktbGlrZScsXG4gICAgICBwcmVmaXg6IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCdOb2RlTGlzdFsnKTtcbiAgICAgIH0sXG4gICAgICBzdWZmaXg6IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgZGVsaW1pdGVyOiBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnZGVsaW1pdGVyJyk7XG4gICAgICB9LFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBvYmogJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLmxlbmd0aCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLnRvU3RyaW5nID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5pdGVtID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgb2JqLnRvU3RyaW5nKCkuaW5kZXhPZignTm9kZUxpc3QnKSAhPT0gLTFcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRG9jVHlwZScsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMTAgJiYgJ3B1YmxpY0lkJyBpbiBvYmo7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3R5cGUsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgb3V0cHV0LmNvZGUoJzwhRE9DVFlQRSAnICsgZG9jdHlwZS5uYW1lICsgJz4nLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS50b1N0cmluZygpID09PSBiLnRvU3RyaW5nKCk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZikge1xuICAgICAgICB2YXIgZCA9IGRpZmYoJzwhRE9DVFlQRSAnICsgYWN0dWFsLm5hbWUgKyAnPicsICc8IURPQ1RZUEUgJyArIGV4cGVjdGVkLm5hbWUgKyAnPicpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gOSAmJiBvYmouZG9jdW1lbnRFbGVtZW50ICYmIG9iai5pbXBsZW1lbnRhdGlvbjtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxFbGVtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxICYmIG9iai5ub2RlTmFtZSAmJiBvYmouYXR0cmlidXRlcyAmJiBvYmoub3V0ZXJIVE1MO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYiwgZXF1YWwpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gYi5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICYmIGVxdWFsKGdldEF0dHJpYnV0ZXMoYSksIGdldEF0dHJpYnV0ZXMoYikpICYmIGVxdWFsKGEuY2hpbGROb2RlcywgYi5jaGlsZE5vZGVzKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBzdGFydFRhZyA9ICc8JyArIGVsZW1lbnROYW1lO1xuICAgICAgICB2YXIgYXR0cnMgPSBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpO1xuXG4gICAgICAgIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICBpZiAoaXNCb29sZWFuQXR0cmlidXRlKGtleSkpIHtcbiAgICAgICAgICAgIHN0YXJ0VGFnICs9ICcgJyArIGtleTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnRUYWcgKz0gJyAnICsga2V5ICsgJz1cIicgKyBhdHRyc1trZXldLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpICsgJ1wiJztcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBpbnNwZWN0ZWRDaGlsZHJlbiA9IFtdO1xuICAgICAgICBpZiAoZWxlbWVudE5hbWUgPT09ICdzY3JpcHQnKSB7XG4gICAgICAgICAgdmFyIHR5cGUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpO1xuICAgICAgICAgIGlmICghdHlwZSB8fCAvamF2YXNjcmlwdC8udGVzdCh0eXBlKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdqYXZhc2NyaXB0JztcbiAgICAgICAgICB9XG4gICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIHR5cGUpKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50TmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpIHx8ICd0ZXh0L2NzcycpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKGluc3BlY3QoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHdpZHRoID0gMDtcbiAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgdmFyIHNpemUgPSBvLnNpemUoKTtcbiAgICAgICAgICB3aWR0aCArPSBzaXplLndpZHRoO1xuICAgICAgICAgIHJldHVybiB3aWR0aCA+IDUwIHx8IG8uaGVpZ2h0ID4gMTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc3RhcnRUYWcgKz0gJz4nO1xuICAgICAgICBvdXRwdXQuY29kZShzdGFydFRhZywgJ2h0bWwnKTtcbiAgICAgICAgaWYgKGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICBpZiAobXVsdGlwbGVMaW5lcykge1xuICAgICAgICAgICAgb3V0cHV0Lm5sKCkuaW5kZW50TGluZXMoKTtcblxuICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAoaW5zcGVjdGVkQ2hpbGQsIGluZGV4KSB7XG4gICAgICAgICAgICAgIG91dHB1dC5pKCkuYmxvY2soaW5zcGVjdGVkQ2hpbGQpLm5sKCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgb3V0cHV0Lm91dGRlbnRMaW5lcygpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChpbnNwZWN0ZWRDaGlsZCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgb3V0cHV0LmFwcGVuZChpbnNwZWN0ZWRDaGlsZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGVsZW1lbnQpLCAnaHRtbCcpO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfSxcbiAgICAgIGRpZmZMaW1pdDogNTEyLFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBkaWZmOiBvdXRwdXQsXG4gICAgICAgICAgaW5saW5lOiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCkgPiB0aGlzLmRpZmZMaW1pdCkge1xuICAgICAgICAgIHJlc3VsdC5kaWZmLmpzQ29tbWVudCgnRGlmZiBzdXBwcmVzc2VkIGR1ZSB0byBzaXplID4gJyArIHRoaXMuZGlmZkxpbWl0KTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVtcHR5RWxlbWVudHMgPSBhY3R1YWwuY2hpbGROb2Rlcy5sZW5ndGggPT09IDAgJiYgZXhwZWN0ZWQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDA7XG4gICAgICAgIHZhciBjb25mbGljdGluZ0VsZW1lbnQgPSBhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAhPT0gZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSB8fCAhZXF1YWwoZ2V0QXR0cmlidXRlcyhhY3R1YWwpLCBnZXRBdHRyaWJ1dGVzKGV4cGVjdGVkKSk7XG5cbiAgICAgICAgaWYgKCFjb25mbGljdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlTdGFydFRhZyhhY3R1YWwpLCAnaHRtbCcpO1xuICAgICAgICB9IGVsc2UgaWYgKCFlbXB0eUVsZW1lbnRzKSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChkaWZmKHN0cmluZ2lmeVN0YXJ0VGFnKGFjdHVhbCksIHN0cmluZ2lmeVN0YXJ0VGFnKGV4cGVjdGVkKSkuZGlmZik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVtcHR5RWxlbWVudHMpIHtcbiAgICAgICAgICBvdXRwdXQubmwoKS5pbmRlbnRMaW5lcygpO1xuICAgICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICAgIG91dHB1dC5ubCgpLm91dGRlbnRMaW5lcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVtcHR5RWxlbWVudHMgJiYgY29uZmxpY3RpbmdFbGVtZW50KSB7XG4gICAgICAgICAgb3V0cHV0LmFwcGVuZChkaWZmKHN0cmluZ2lmeVN0YXJ0VGFnKGFjdHVhbCkgKyBzdHJpbmdpZnlFbmRUYWcoYWN0dWFsKSwgc3RyaW5naWZ5U3RhcnRUYWcoZXhwZWN0ZWQpICsgc3RyaW5naWZ5RW5kVGFnKGV4cGVjdGVkKSkuZGlmZik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGFjdHVhbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSBleHBlY3RlZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBvdXRwdXQuY29kZShzdHJpbmdpZnlFbmRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3V0cHV0LmFwcGVuZChkaWZmKHN0cmluZ2lmeUVuZFRhZyhhY3R1YWwpLCBzdHJpbmdpZnlFbmRUYWcoZXhwZWN0ZWQpKS5kaWZmKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignSFRNTEVsZW1lbnQnLCAndG8gW29ubHldIGhhdmUgKGF0dHJpYnV0ZXxhdHRyaWJ1dGVzKScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIGNtcCkge1xuICAgICAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhzdWJqZWN0KTtcblxuICAgICAgaWYgKHR5cGVvZiBjbXAgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGV4cGVjdChhdHRycywgJ3RvIFtvbmx5XSBoYXZlIGtleXMnLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjbXApKSB7XG4gICAgICAgIGV4cGVjdChhdHRycywgJ3RvIFtvbmx5XSBoYXZlIGtleXMnLCBjbXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5mbGFncy5leGhhdXN0aXZlbHkgPSB0aGlzLmZsYWdzLm9ubHk7XG5cbiAgICAgICAgZXhwZWN0KGF0dHJzLCAndG8gW2V4aGF1c3RpdmVseV0gc2F0aXNmeScsIGNtcCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKCdIVE1MRWxlbWVudCcsICd0byBoYXZlIFtub10gKGNoaWxkfGNoaWxkcmVuKScsIGZ1bmN0aW9uIChleHBlY3QsIHN1YmplY3QsIHF1ZXJ5LCBjbXApIHtcbiAgICAgIGlmICh0aGlzLmZsYWdzLm5vKSB7XG4gICAgICAgIHRoaXMuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICAgIHJldHVybiBleHBlY3QoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc3ViamVjdC5jaGlsZE5vZGVzKSwgJ3RvIGJlIGFuIGVtcHR5IGFycmF5Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpKTtcbiAgICAgICAgdGhyb3cgY2hpbGRyZW47XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKFsnSFRNTERvY3VtZW50JywgJ0hUTUxFbGVtZW50J10sICdxdWVyaWVkIGZvciBbZmlyc3RdJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBxdWVyeVJlc3VsdDtcbiAgICAgIGlmICh0aGlzLmZsYWdzLmZpcnN0KSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHZhbHVlKTtcbiAgICAgICAgaWYgKCFxdWVyeVJlc3VsdCkge1xuICAgICAgICAgIHRoaXMuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgb3V0cHV0LmVycm9yKCdUaGUgc2VsZWN0b3InKS5zcCgpLmpzU3RyaW5nKHZhbHVlKS5zcCgpLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcXVlcnlSZXN1bHQgPSBzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwodmFsdWUpO1xuICAgICAgICBpZiAocXVlcnlSZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgICBleHBlY3QuZmFpbChmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICBvdXRwdXQuZXJyb3IoJ1RoZSBzZWxlY3RvcicpLnNwKCkuanNTdHJpbmcodmFsdWUpLnNwKCkuZXJyb3IoJ3lpZWxkZWQgbm8gcmVzdWx0cycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNoaWZ0KGV4cGVjdCwgcXVlcnlSZXN1bHQsIDEpO1xuICAgIH0pO1xuICB9XG59O1xuIiwidmFyIGFycmF5RGlmZiA9IHJlcXVpcmUoJ2FycmF5ZGlmZicpO1xuXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0KSB7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgT2JqZWN0LmtleXMoc291cmNlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV07XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGFycmF5Q2hhbmdlcyhhY3R1YWwsIGV4cGVjdGVkLCBlcXVhbCwgc2ltaWxhcikge1xuICAgIHZhciBtdXRhdGVkQXJyYXkgPSBuZXcgQXJyYXkoYWN0dWFsLmxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBrID0gMDsgayA8IGFjdHVhbC5sZW5ndGg7IGsgKz0gMSkge1xuICAgICAgICBtdXRhdGVkQXJyYXlba10gPSB7XG4gICAgICAgICAgICB0eXBlOiAnc2ltaWxhcicsXG4gICAgICAgICAgICB2YWx1ZTogYWN0dWFsW2tdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKG11dGF0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgIG11dGF0ZWRBcnJheVttdXRhdGVkQXJyYXkubGVuZ3RoIC0gMV0ubGFzdCA9IHRydWU7XG4gICAgfVxuXG4gICAgc2ltaWxhciA9IHNpbWlsYXIgfHwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICB2YXIgaXRlbXNEaWZmID0gYXJyYXlEaWZmKGFjdHVhbCwgZXhwZWN0ZWQsIGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBlcXVhbChhLCBiKSB8fCBzaW1pbGFyKGEsIGIpO1xuICAgIH0pO1xuXG4gICAgdmFyIHJlbW92ZVRhYmxlID0gW107XG4gICAgZnVuY3Rpb24gb2Zmc2V0SW5kZXgoaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4ICsgKHJlbW92ZVRhYmxlW2luZGV4IC0gMV0gfHwgMCk7XG4gICAgfVxuXG4gICAgdmFyIHJlbW92ZXMgPSBpdGVtc0RpZmYuZmlsdGVyKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICByZXR1cm4gZGlmZkl0ZW0udHlwZSA9PT0gJ3JlbW92ZSc7XG4gICAgfSk7XG5cbiAgICB2YXIgcmVtb3Zlc0J5SW5kZXggPSB7fTtcbiAgICB2YXIgcmVtb3ZlZEl0ZW1zID0gMDtcbiAgICByZW1vdmVzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHZhciByZW1vdmVJbmRleCA9IHJlbW92ZWRJdGVtcyArIGRpZmZJdGVtLmluZGV4O1xuICAgICAgICBtdXRhdGVkQXJyYXkuc2xpY2UocmVtb3ZlSW5kZXgsIGRpZmZJdGVtLmhvd01hbnkgKyByZW1vdmVJbmRleCkuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgdi50eXBlID0gJ3JlbW92ZSc7XG4gICAgICAgIH0pO1xuICAgICAgICByZW1vdmVkSXRlbXMgKz0gZGlmZkl0ZW0uaG93TWFueTtcbiAgICAgICAgcmVtb3Zlc0J5SW5kZXhbZGlmZkl0ZW0uaW5kZXhdID0gcmVtb3ZlZEl0ZW1zO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gdXBkYXRlUmVtb3ZlVGFibGUoKSB7XG4gICAgICAgIHJlbW92ZWRJdGVtcyA9IDA7XG4gICAgICAgIGFjdHVhbC5mb3JFYWNoKGZ1bmN0aW9uIChfLCBpbmRleCkge1xuICAgICAgICAgICAgcmVtb3ZlZEl0ZW1zICs9IHJlbW92ZXNCeUluZGV4W2luZGV4XSB8fCAwO1xuICAgICAgICAgICAgcmVtb3ZlVGFibGVbaW5kZXhdID0gcmVtb3ZlZEl0ZW1zO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB1cGRhdGVSZW1vdmVUYWJsZSgpO1xuXG4gICAgdmFyIG1vdmVzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdtb3ZlJztcbiAgICB9KTtcblxuICAgIHZhciBtb3ZlZEl0ZW1zID0gMDtcbiAgICBtb3Zlcy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgbW92ZUZyb21JbmRleCA9IG9mZnNldEluZGV4KGRpZmZJdGVtLmZyb20pO1xuICAgICAgICB2YXIgcmVtb3ZlZCA9IG11dGF0ZWRBcnJheS5zbGljZShtb3ZlRnJvbUluZGV4LCBkaWZmSXRlbS5ob3dNYW55ICsgbW92ZUZyb21JbmRleCk7XG4gICAgICAgIHZhciBhZGRlZCA9IHJlbW92ZWQubWFwKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kKHt9LCB2LCB7IGxhc3Q6IGZhbHNlLCB0eXBlOiAnaW5zZXJ0JyB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgdi50eXBlID0gJ3JlbW92ZSc7XG4gICAgICAgIH0pO1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KG11dGF0ZWRBcnJheSwgW29mZnNldEluZGV4KGRpZmZJdGVtLnRvKSwgMF0uY29uY2F0KGFkZGVkKSk7XG4gICAgICAgIG1vdmVkSXRlbXMgKz0gZGlmZkl0ZW0uaG93TWFueTtcbiAgICAgICAgcmVtb3Zlc0J5SW5kZXhbZGlmZkl0ZW0uZnJvbV0gPSBtb3ZlZEl0ZW1zO1xuICAgICAgICB1cGRhdGVSZW1vdmVUYWJsZSgpO1xuICAgIH0pO1xuXG4gICAgdmFyIGluc2VydHMgPSBpdGVtc0RpZmYuZmlsdGVyKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICByZXR1cm4gZGlmZkl0ZW0udHlwZSA9PT0gJ2luc2VydCc7XG4gICAgfSk7XG5cbiAgICBpbnNlcnRzLmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHZhciBhZGRlZCA9IG5ldyBBcnJheShkaWZmSXRlbS52YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZGlmZkl0ZW0udmFsdWVzLmxlbmd0aCA7IGkgKz0gMSkge1xuICAgICAgICAgICAgYWRkZWRbaV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGRpZmZJdGVtLnZhbHVlc1tpXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KG11dGF0ZWRBcnJheSwgW29mZnNldEluZGV4KGRpZmZJdGVtLmluZGV4KSwgMF0uY29uY2F0KGFkZGVkKSk7XG4gICAgfSk7XG5cbiAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICBtdXRhdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0sIGluZGV4KSB7XG4gICAgICAgIHZhciB0eXBlID0gZGlmZkl0ZW0udHlwZTtcbiAgICAgICAgaWYgKHR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgICAgICBvZmZzZXQgLT0gMTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnc2ltaWxhcicpIHtcbiAgICAgICAgICAgIGRpZmZJdGVtLmV4cGVjdGVkID0gZXhwZWN0ZWRbb2Zmc2V0ICsgaW5kZXhdO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB2YXIgY29uZmxpY3RzID0gbXV0YXRlZEFycmF5LnJlZHVjZShmdW5jdGlvbiAoY29uZmxpY3RzLCBpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLnR5cGUgPT09ICdzaW1pbGFyJyA/IGNvbmZsaWN0cyA6IGNvbmZsaWN0cyArIDE7XG4gICAgfSwgMCk7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgYyA9IDA7IGkgPCBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpICYmICBjIDw9IGNvbmZsaWN0czsgaSArPSAxKSB7XG4gICAgICAgIHZhciBleHBlY3RlZFR5cGUgPSB0eXBlb2YgZXhwZWN0ZWRbaV07XG4gICAgICAgIHZhciBhY3R1YWxUeXBlID0gdHlwZW9mIGFjdHVhbFtpXTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICBhY3R1YWxUeXBlICE9PSBleHBlY3RlZFR5cGUgfHxcbiAgICAgICAgICAgICAgICAoKGFjdHVhbFR5cGUgPT09ICdvYmplY3QnIHx8IGFjdHVhbFR5cGUgPT09ICdzdHJpbmcnKSAmJiAhc2ltaWxhcihhY3R1YWxbaV0sIGV4cGVjdGVkW2ldKSkgfHxcbiAgICAgICAgICAgICAgICAoYWN0dWFsVHlwZSAhPT0gJ29iamVjdCcgJiYgYWN0dWFsVHlwZSAhPT0gJ3N0cmluZycgJiYgIWVxdWFsKGFjdHVhbFtpXSwgZXhwZWN0ZWRbaV0pKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGMgKz0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjIDw9IGNvbmZsaWN0cykge1xuICAgICAgICBtdXRhdGVkQXJyYXkgPSBbXTtcbiAgICAgICAgdmFyIGo7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBNYXRoLm1pbihhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpOyBqICs9IDEpIHtcbiAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc2ltaWxhcicsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGFjdHVhbFtqXSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWRbal1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFjdHVhbC5sZW5ndGggPCBleHBlY3RlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAoOyBqIDwgTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTsgaiArPSAxKSB7XG4gICAgICAgICAgICAgICAgbXV0YXRlZEFycmF5LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGV4cGVjdGVkW2pdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKDsgaiA8IE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxbal1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobXV0YXRlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG11dGF0ZWRBcnJheVttdXRhdGVkQXJyYXkubGVuZ3RoIC0gMV0ubGFzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtdXRhdGVkQXJyYXkuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgaWYgKGRpZmZJdGVtLnR5cGUgPT09ICdzaW1pbGFyJyAmJiBlcXVhbChkaWZmSXRlbS52YWx1ZSwgZGlmZkl0ZW0uZXhwZWN0ZWQpKSB7XG4gICAgICAgICAgICBkaWZmSXRlbS50eXBlID0gJ2VxdWFsJztcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG11dGF0ZWRBcnJheTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGFycmF5RGlmZjtcblxuLy8gQmFzZWQgb24gc29tZSByb3VnaCBiZW5jaG1hcmtpbmcsIHRoaXMgYWxnb3JpdGhtIGlzIGFib3V0IE8oMm4pIHdvcnN0IGNhc2UsXG4vLyBhbmQgaXQgY2FuIGNvbXB1dGUgZGlmZnMgb24gcmFuZG9tIGFycmF5cyBvZiBsZW5ndGggMTAyNCBpbiBhYm91dCAzNG1zLFxuLy8gdGhvdWdoIGp1c3QgYSBmZXcgY2hhbmdlcyBvbiBhbiBhcnJheSBvZiBsZW5ndGggMTAyNCB0YWtlcyBhYm91dCAwLjVtc1xuXG5hcnJheURpZmYuSW5zZXJ0RGlmZiA9IEluc2VydERpZmY7XG5hcnJheURpZmYuUmVtb3ZlRGlmZiA9IFJlbW92ZURpZmY7XG5hcnJheURpZmYuTW92ZURpZmYgPSBNb3ZlRGlmZjtcblxuZnVuY3Rpb24gSW5zZXJ0RGlmZihpbmRleCwgdmFsdWVzKSB7XG4gIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgdGhpcy52YWx1ZXMgPSB2YWx1ZXM7XG59XG5JbnNlcnREaWZmLnByb3RvdHlwZS50eXBlID0gJ2luc2VydCc7XG5JbnNlcnREaWZmLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiB0aGlzLnR5cGVcbiAgLCBpbmRleDogdGhpcy5pbmRleFxuICAsIHZhbHVlczogdGhpcy52YWx1ZXNcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIFJlbW92ZURpZmYoaW5kZXgsIGhvd01hbnkpIHtcbiAgdGhpcy5pbmRleCA9IGluZGV4O1xuICB0aGlzLmhvd01hbnkgPSBob3dNYW55O1xufVxuUmVtb3ZlRGlmZi5wcm90b3R5cGUudHlwZSA9ICdyZW1vdmUnO1xuUmVtb3ZlRGlmZi5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogdGhpcy50eXBlXG4gICwgaW5kZXg6IHRoaXMuaW5kZXhcbiAgLCBob3dNYW55OiB0aGlzLmhvd01hbnlcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIE1vdmVEaWZmKGZyb20sIHRvLCBob3dNYW55KSB7XG4gIHRoaXMuZnJvbSA9IGZyb207XG4gIHRoaXMudG8gPSB0bztcbiAgdGhpcy5ob3dNYW55ID0gaG93TWFueTtcbn1cbk1vdmVEaWZmLnByb3RvdHlwZS50eXBlID0gJ21vdmUnO1xuTW92ZURpZmYucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IHRoaXMudHlwZVxuICAsIGZyb206IHRoaXMuZnJvbVxuICAsIHRvOiB0aGlzLnRvXG4gICwgaG93TWFueTogdGhpcy5ob3dNYW55XG4gIH07XG59O1xuXG5mdW5jdGlvbiBzdHJpY3RFcXVhbChhLCBiKSB7XG4gIHJldHVybiBhID09PSBiO1xufVxuXG5mdW5jdGlvbiBhcnJheURpZmYoYmVmb3JlLCBhZnRlciwgZXF1YWxGbikge1xuICBpZiAoIWVxdWFsRm4pIGVxdWFsRm4gPSBzdHJpY3RFcXVhbDtcblxuICAvLyBGaW5kIGFsbCBpdGVtcyBpbiBib3RoIHRoZSBiZWZvcmUgYW5kIGFmdGVyIGFycmF5LCBhbmQgcmVwcmVzZW50IHRoZW1cbiAgLy8gYXMgbW92ZXMuIE1hbnkgb2YgdGhlc2UgXCJtb3Zlc1wiIG1heSBlbmQgdXAgYmVpbmcgZGlzY2FyZGVkIGluIHRoZSBsYXN0XG4gIC8vIHBhc3MgaWYgdGhleSBhcmUgZnJvbSBhbiBpbmRleCB0byB0aGUgc2FtZSBpbmRleCwgYnV0IHdlIGRvbid0IGtub3cgdGhpc1xuICAvLyB1cCBmcm9udCwgc2luY2Ugd2UgaGF2ZW4ndCB5ZXQgb2Zmc2V0IHRoZSBpbmRpY2VzLlxuICAvLyBcbiAgLy8gQWxzbyBrZWVwIGEgbWFwIG9mIGFsbCB0aGUgaW5kaWNpZXMgYWNjb3VudGVkIGZvciBpbiB0aGUgYmVmb3JlIGFuZCBhZnRlclxuICAvLyBhcnJheXMuIFRoZXNlIG1hcHMgYXJlIHVzZWQgbmV4dCB0byBjcmVhdGUgaW5zZXJ0IGFuZCByZW1vdmUgZGlmZnMuXG4gIHZhciBiZWZvcmVMZW5ndGggPSBiZWZvcmUubGVuZ3RoO1xuICB2YXIgYWZ0ZXJMZW5ndGggPSBhZnRlci5sZW5ndGg7XG4gIHZhciBtb3ZlcyA9IFtdO1xuICB2YXIgYmVmb3JlTWFya2VkID0ge307XG4gIHZhciBhZnRlck1hcmtlZCA9IHt9O1xuICBmb3IgKHZhciBiZWZvcmVJbmRleCA9IDA7IGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoOyBiZWZvcmVJbmRleCsrKSB7XG4gICAgdmFyIGJlZm9yZUl0ZW0gPSBiZWZvcmVbYmVmb3JlSW5kZXhdO1xuICAgIGZvciAodmFyIGFmdGVySW5kZXggPSAwOyBhZnRlckluZGV4IDwgYWZ0ZXJMZW5ndGg7IGFmdGVySW5kZXgrKykge1xuICAgICAgaWYgKGFmdGVyTWFya2VkW2FmdGVySW5kZXhdKSBjb250aW51ZTtcbiAgICAgIGlmICghZXF1YWxGbihiZWZvcmVJdGVtLCBhZnRlclthZnRlckluZGV4XSkpIGNvbnRpbnVlO1xuICAgICAgdmFyIGZyb20gPSBiZWZvcmVJbmRleDtcbiAgICAgIHZhciB0byA9IGFmdGVySW5kZXg7XG4gICAgICB2YXIgaG93TWFueSA9IDA7XG4gICAgICBkbyB7XG4gICAgICAgIGJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleCsrXSA9IGFmdGVyTWFya2VkW2FmdGVySW5kZXgrK10gPSB0cnVlO1xuICAgICAgICBob3dNYW55Kys7XG4gICAgICB9IHdoaWxlIChcbiAgICAgICAgYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGggJiZcbiAgICAgICAgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoICYmXG4gICAgICAgIGVxdWFsRm4oYmVmb3JlW2JlZm9yZUluZGV4XSwgYWZ0ZXJbYWZ0ZXJJbmRleF0pICYmXG4gICAgICAgICFhZnRlck1hcmtlZFthZnRlckluZGV4XVxuICAgICAgKTtcbiAgICAgIG1vdmVzLnB1c2gobmV3IE1vdmVEaWZmKGZyb20sIHRvLCBob3dNYW55KSk7XG4gICAgICBiZWZvcmVJbmRleC0tO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gQ3JlYXRlIGEgcmVtb3ZlIGZvciBhbGwgb2YgdGhlIGl0ZW1zIGluIHRoZSBiZWZvcmUgYXJyYXkgdGhhdCB3ZXJlXG4gIC8vIG5vdCBtYXJrZWQgYXMgYmVpbmcgbWF0Y2hlZCBpbiB0aGUgYWZ0ZXIgYXJyYXkgYXMgd2VsbFxuICB2YXIgcmVtb3ZlcyA9IFtdO1xuICBmb3IgKGJlZm9yZUluZGV4ID0gMDsgYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGg7KSB7XG4gICAgaWYgKGJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleF0pIHtcbiAgICAgIGJlZm9yZUluZGV4Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdmFyIGluZGV4ID0gYmVmb3JlSW5kZXg7XG4gICAgdmFyIGhvd01hbnkgPSAwO1xuICAgIHdoaWxlIChiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aCAmJiAhYmVmb3JlTWFya2VkW2JlZm9yZUluZGV4KytdKSB7XG4gICAgICBob3dNYW55Kys7XG4gICAgfVxuICAgIHJlbW92ZXMucHVzaChuZXcgUmVtb3ZlRGlmZihpbmRleCwgaG93TWFueSkpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIGFuIGluc2VydCBmb3IgYWxsIG9mIHRoZSBpdGVtcyBpbiB0aGUgYWZ0ZXIgYXJyYXkgdGhhdCB3ZXJlXG4gIC8vIG5vdCBtYXJrZWQgYXMgYmVpbmcgbWF0Y2hlZCBpbiB0aGUgYmVmb3JlIGFycmF5IGFzIHdlbGxcbiAgdmFyIGluc2VydHMgPSBbXTtcbiAgZm9yIChhZnRlckluZGV4ID0gMDsgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoOykge1xuICAgIGlmIChhZnRlck1hcmtlZFthZnRlckluZGV4XSkge1xuICAgICAgYWZ0ZXJJbmRleCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IGFmdGVySW5kZXg7XG4gICAgdmFyIGhvd01hbnkgPSAwO1xuICAgIHdoaWxlIChhZnRlckluZGV4IDwgYWZ0ZXJMZW5ndGggJiYgIWFmdGVyTWFya2VkW2FmdGVySW5kZXgrK10pIHtcbiAgICAgIGhvd01hbnkrKztcbiAgICB9XG4gICAgdmFyIHZhbHVlcyA9IGFmdGVyLnNsaWNlKGluZGV4LCBpbmRleCArIGhvd01hbnkpO1xuICAgIGluc2VydHMucHVzaChuZXcgSW5zZXJ0RGlmZihpbmRleCwgdmFsdWVzKSk7XG4gIH1cblxuICB2YXIgaW5zZXJ0c0xlbmd0aCA9IGluc2VydHMubGVuZ3RoO1xuICB2YXIgcmVtb3Zlc0xlbmd0aCA9IHJlbW92ZXMubGVuZ3RoO1xuICB2YXIgbW92ZXNMZW5ndGggPSBtb3Zlcy5sZW5ndGg7XG4gIHZhciBpLCBqO1xuXG4gIC8vIE9mZnNldCBzdWJzZXF1ZW50IHJlbW92ZXMgYW5kIG1vdmVzIGJ5IHJlbW92ZXNcbiAgdmFyIGNvdW50ID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHJlbW92ZXNMZW5ndGg7IGkrKykge1xuICAgIHZhciByZW1vdmUgPSByZW1vdmVzW2ldO1xuICAgIHJlbW92ZS5pbmRleCAtPSBjb3VudDtcbiAgICBjb3VudCArPSByZW1vdmUuaG93TWFueTtcbiAgICBmb3IgKGogPSAwOyBqIDwgbW92ZXNMZW5ndGg7IGorKykge1xuICAgICAgdmFyIG1vdmUgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChtb3ZlLmZyb20gPj0gcmVtb3ZlLmluZGV4KSBtb3ZlLmZyb20gLT0gcmVtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT2Zmc2V0IG1vdmVzIGJ5IGluc2VydHNcbiAgZm9yIChpID0gaW5zZXJ0c0xlbmd0aDsgaS0tOykge1xuICAgIHZhciBpbnNlcnQgPSBpbnNlcnRzW2ldO1xuICAgIHZhciBob3dNYW55ID0gaW5zZXJ0LnZhbHVlcy5sZW5ndGg7XG4gICAgZm9yIChqID0gbW92ZXNMZW5ndGg7IGotLTspIHtcbiAgICAgIHZhciBtb3ZlID0gbW92ZXNbal07XG4gICAgICBpZiAobW92ZS50byA+PSBpbnNlcnQuaW5kZXgpIG1vdmUudG8gLT0gaG93TWFueTtcbiAgICB9XG4gIH1cblxuICAvLyBPZmZzZXQgdGhlIHRvIG9mIG1vdmVzIGJ5IGxhdGVyIG1vdmVzXG4gIGZvciAoaSA9IG1vdmVzTGVuZ3RoOyBpLS0gPiAxOykge1xuICAgIHZhciBtb3ZlID0gbW92ZXNbaV07XG4gICAgaWYgKG1vdmUudG8gPT09IG1vdmUuZnJvbSkgY29udGludWU7XG4gICAgZm9yIChqID0gaTsgai0tOykge1xuICAgICAgdmFyIGVhcmxpZXIgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChlYXJsaWVyLnRvID49IG1vdmUudG8pIGVhcmxpZXIudG8gLT0gbW92ZS5ob3dNYW55O1xuICAgICAgaWYgKGVhcmxpZXIudG8gPj0gbW92ZS5mcm9tKSBlYXJsaWVyLnRvICs9IG1vdmUuaG93TWFueTtcbiAgICB9XG4gIH1cblxuICAvLyBPbmx5IG91dHB1dCBtb3ZlcyB0aGF0IGVuZCB1cCBoYXZpbmcgYW4gZWZmZWN0IGFmdGVyIG9mZnNldHRpbmdcbiAgdmFyIG91dHB1dE1vdmVzID0gW107XG5cbiAgLy8gT2Zmc2V0IHRoZSBmcm9tIG9mIG1vdmVzIGJ5IGVhcmxpZXIgbW92ZXNcbiAgZm9yIChpID0gMDsgaSA8IG1vdmVzTGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgbW92ZSA9IG1vdmVzW2ldO1xuICAgIGlmIChtb3ZlLnRvID09PSBtb3ZlLmZyb20pIGNvbnRpbnVlO1xuICAgIG91dHB1dE1vdmVzLnB1c2gobW92ZSk7XG4gICAgZm9yIChqID0gaSArIDE7IGogPCBtb3Zlc0xlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgbGF0ZXIgPSBtb3Zlc1tqXTtcbiAgICAgIGlmIChsYXRlci5mcm9tID49IG1vdmUuZnJvbSkgbGF0ZXIuZnJvbSAtPSBtb3ZlLmhvd01hbnk7XG4gICAgICBpZiAobGF0ZXIuZnJvbSA+PSBtb3ZlLnRvKSBsYXRlci5mcm9tICs9IG1vdmUuaG93TWFueTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVtb3Zlcy5jb25jYXQob3V0cHV0TW92ZXMsIGluc2VydHMpO1xufVxuIl19
