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

},{"array-changes":2,"extend":4,"jsdom":"jsdom"}],2:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXJyYXktY2hhbmdlcy9saWIvYXJyYXlDaGFuZ2VzLmpzIiwibm9kZV9tb2R1bGVzL2FycmF5LWNoYW5nZXMvbm9kZV9tb2R1bGVzL2FycmF5ZGlmZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGFycmF5Q2hhbmdlcyA9IHJlcXVpcmUoJ2FycmF5LWNoYW5nZXMnKTtcbnZhciBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKTtcblxuLy8gRnJvbSBodG1sLW1pbmlmaWVyXG52YXIgZW51bWVyYXRlZEF0dHJpYnV0ZVZhbHVlcyA9IHtcbiAgZHJhZ2dhYmxlOiBbJ3RydWUnLCAnZmFsc2UnXSAvLyBkZWZhdWx0cyB0byAnYXV0bydcbn07XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbkF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKSB7XG4gIHZhciBpc1NpbXBsZUJvb2xlYW4gPSAoL14oPzphbGxvd2Z1bGxzY3JlZW58YXN5bmN8YXV0b2ZvY3VzfGF1dG9wbGF5fGNoZWNrZWR8Y29tcGFjdHxjb250cm9sc3xkZWNsYXJlfGRlZmF1bHR8ZGVmYXVsdGNoZWNrZWR8ZGVmYXVsdG11dGVkfGRlZmF1bHRzZWxlY3RlZHxkZWZlcnxkaXNhYmxlZHxlbmFibGVkfGZvcm1ub3ZhbGlkYXRlfGhpZGRlbnxpbmRldGVybWluYXRlfGluZXJ0fGlzbWFwfGl0ZW1zY29wZXxsb29wfG11bHRpcGxlfG11dGVkfG5vaHJlZnxub3Jlc2l6ZXxub3NoYWRlfG5vdmFsaWRhdGV8bm93cmFwfG9wZW58cGF1c2VvbmV4aXR8cmVhZG9ubHl8cmVxdWlyZWR8cmV2ZXJzZWR8c2NvcGVkfHNlYW1sZXNzfHNlbGVjdGVkfHNvcnRhYmxlfHNwZWxsY2hlY2t8dHJ1ZXNwZWVkfHR5cGVtdXN0bWF0Y2h8dmlzaWJsZSkkL2kpLnRlc3QoYXR0ck5hbWUpO1xuICBpZiAoaXNTaW1wbGVCb29sZWFuKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgYXR0clZhbHVlRW51bWVyYXRpb24gPSBlbnVtZXJhdGVkQXR0cmlidXRlVmFsdWVzW2F0dHJOYW1lLnRvTG93ZXJDYXNlKCldO1xuICBpZiAoIWF0dHJWYWx1ZUVudW1lcmF0aW9uKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGVsc2Uge1xuICAgIHJldHVybiAoLTEgPT09IGF0dHJWYWx1ZUVudW1lcmF0aW9uLmluZGV4T2YoYXR0clZhbHVlLnRvTG93ZXJDYXNlKCkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgcmVzdWx0ID0ge307XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChhdHRyc1tpXS5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBhdHRyc1tpXS52YWx1ZSAmJiBhdHRyc1tpXS52YWx1ZS5zcGxpdCgnICcpIHx8IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRbYXR0cnNbaV0ubmFtZV0gPSBpc0Jvb2xlYW5BdHRyaWJ1dGUoYXR0cnNbaV0ubmFtZSkgPyB0cnVlIDogKGF0dHJzW2ldLnZhbHVlIHx8ICcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgdmFyIGF0dHJzID0gZ2V0QXR0cmlidXRlcyhlbGVtZW50KTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGF0dHJzKS5zb3J0KCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBhdHRyc1trZXldO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpc1ZvaWRFbGVtZW50KGVsZW1lbnROYW1lKSB7XG4gIHJldHVybiAoLyg/OmFyZWF8YmFzZXxicnxjb2x8ZW1iZWR8aHJ8aW1nfGlucHV0fGtleWdlbnxsaW5rfG1lbnVpdGVtfG1ldGF8cGFyYW18c291cmNlfHRyYWNrfHdicikvaSkudGVzdChlbGVtZW50TmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeVN0YXJ0VGFnKGVsZW1lbnQpIHtcbiAgdmFyIGVsZW1lbnROYW1lID0gZWxlbWVudC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICB2YXIgc3RyID0gJzwnICsgZWxlbWVudE5hbWU7XG4gIHZhciBhdHRycyA9IGdldENhbm9uaWNhbEF0dHJpYnV0ZXMoZWxlbWVudCk7XG5cbiAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGlmIChpc0Jvb2xlYW5BdHRyaWJ1dGUoa2V5KSkge1xuICAgICAgc3RyICs9ICcgJyArIGtleTtcbiAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ2NsYXNzJykge1xuICAgICAgc3RyICs9ICcgY2xhc3M9XCInICsgYXR0cnNba2V5XS5qb2luKCcgJykgKyAnXCInO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsga2V5ICsgJz1cIicgKyBhdHRyc1trZXldLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpICsgJ1wiJztcbiAgICB9XG4gIH0pO1xuXG4gIHN0ciArPSAnPic7XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUVuZFRhZyhlbGVtZW50KSB7XG4gIHZhciBlbGVtZW50TmFtZSA9IGVsZW1lbnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGlzVm9pZEVsZW1lbnQoZWxlbWVudE5hbWUpICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJyc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICc8LycgKyBlbGVtZW50TmFtZSArICc+JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkaWZmTm9kZUxpc3RzKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgdmFyIGNoYW5nZXMgPSBhcnJheUNoYW5nZXMoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYWN0dWFsKSwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZXhwZWN0ZWQpLCBlcXVhbCwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAvLyBGaWd1cmUgb3V0IHdoZXRoZXIgYSBhbmQgYiBhcmUgXCJzdHJ1dHVyYWxseSBzaW1pbGFyXCIgc28gdGhleSBjYW4gYmUgZGlmZmVkIGlubGluZS5cbiAgICByZXR1cm4gKFxuICAgICAgYS5ub2RlVHlwZSA9PT0gMSAmJiBiLm5vZGVUeXBlID09PSAxICYmXG4gICAgICBhLm5vZGVOYW1lID09PSBiLm5vZGVOYW1lXG4gICAgKTtcbiAgfSk7XG5cbiAgY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSwgaW5kZXgpIHtcbiAgICBvdXRwdXQuaSgpLmJsb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB0eXBlID0gZGlmZkl0ZW0udHlwZTtcbiAgICAgIGlmICh0eXBlID09PSAnaW5zZXJ0Jykge1xuICAgICAgICB0aGlzLmFubm90YXRpb25CbG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignbWlzc2luZyAnKS5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAncmVtb3ZlJykge1xuICAgICAgICB0aGlzLmJsb2NrKGluc3BlY3QoZGlmZkl0ZW0udmFsdWUpLnNwKCkuZXJyb3IoJy8vIHNob3VsZCBiZSByZW1vdmVkJykpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnZXF1YWwnKSB7XG4gICAgICAgIHRoaXMuYmxvY2soaW5zcGVjdChkaWZmSXRlbS52YWx1ZSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHZhbHVlRGlmZiA9IGRpZmYoZGlmZkl0ZW0udmFsdWUsIGRpZmZJdGVtLmV4cGVjdGVkKTtcbiAgICAgICAgaWYgKHZhbHVlRGlmZiAmJiB2YWx1ZURpZmYuaW5saW5lKSB7XG4gICAgICAgICAgdGhpcy5ibG9jayh2YWx1ZURpZmYuZGlmZik7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWVEaWZmKSB7XG4gICAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKS5zcCgpKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5zaG91bGRFcXVhbEVycm9yKGRpZmZJdGVtLmV4cGVjdGVkLCBpbnNwZWN0KS5ubCgpLmFwcGVuZCh2YWx1ZURpZmYuZGlmZik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5ibG9jayhpbnNwZWN0KGRpZmZJdGVtLnZhbHVlKS5zcCgpKS5hbm5vdGF0aW9uQmxvY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5zaG91bGRFcXVhbEVycm9yKGRpZmZJdGVtLmV4cGVjdGVkLCBpbnNwZWN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLm5sKGluZGV4IDwgY2hhbmdlcy5sZW5ndGggLSAxID8gMSA6IDApO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG5hbWU6ICd1bmV4cGVjdGVkLWRvbScsXG4gIGluc3RhbGxJbnRvOiBmdW5jdGlvbiAoZXhwZWN0KSB7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NTm9kZScsXG4gICAgICBiYXNlOiAnb2JqZWN0JyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVOYW1lICYmIFsyLCAzLCA0LCA1LCA2LCA3LCAxMCwgMTEsIDEyXS5pbmRleE9mKG9iai5ub2RlVHlwZSkgPiAtMTtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoZWxlbWVudC5ub2RlTmFtZSArICcgXCInICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnXCInLCAncHJpc20tc3RyaW5nJyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NQ29tbWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gODtcbiAgICAgIH0sXG4gICAgICBlcXVhbDogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoJzwhLS0nICsgZWxlbWVudC5ub2RlVmFsdWUgKyAnLS0+JywgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgZCA9IGRpZmYoJzwhLS0nICsgYWN0dWFsLm5vZGVWYWx1ZSArICctLT4nLCAnPCEtLScgKyBleHBlY3RlZC5ub2RlVmFsdWUgKyAnLS0+Jyk7XG4gICAgICAgIGQuaW5saW5lID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkVHlwZSh7XG4gICAgICBuYW1lOiAnRE9NVGV4dE5vZGUnLFxuICAgICAgYmFzZTogJ0RPTU5vZGUnLFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDM7XG4gICAgICB9LFxuICAgICAgZXF1YWw6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLm5vZGVWYWx1ZS50cmltKCkgPT09IGIubm9kZVZhbHVlLnRyaW0oKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gb3V0cHV0LmNvZGUoZWxlbWVudC5ub2RlVmFsdWUudHJpbSgpLnJlcGxhY2UoLzwvZywgJyZsdDsnKSwgJ2h0bWwnKTtcbiAgICAgIH0sXG4gICAgICBkaWZmOiBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3V0cHV0LCBkaWZmLCBpbnNwZWN0LCBlcXVhbCkge1xuICAgICAgICB2YXIgZCA9IGRpZmYoYWN0dWFsLm5vZGVWYWx1ZSwgZXhwZWN0ZWQubm9kZVZhbHVlKTtcbiAgICAgICAgZC5pbmxpbmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdET01Ob2RlTGlzdCcsXG4gICAgICBiYXNlOiAnYXJyYXktbGlrZScsXG4gICAgICBwcmVmaXg6IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCdOb2RlTGlzdFsnKTtcbiAgICAgIH0sXG4gICAgICBzdWZmaXg6IGZ1bmN0aW9uIChvdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dC50ZXh0KCddJyk7XG4gICAgICB9LFxuICAgICAgZGVsaW1pdGVyOiBmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQudGV4dCgnZGVsaW1pdGVyJyk7XG4gICAgICB9LFxuICAgICAgaWRlbnRpZnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBvYmogJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLmxlbmd0aCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICB0eXBlb2Ygb2JqLnRvU3RyaW5nID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgdHlwZW9mIG9iai5pdGVtID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgb2JqLnRvU3RyaW5nKCkuaW5kZXhPZignTm9kZUxpc3QnKSAhPT0gLTFcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRUeXBlKHtcbiAgICAgIG5hbWU6ICdIVE1MRG9jVHlwZScsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMTAgJiYgJ3B1YmxpY0lkJyBpbiBvYmo7XG4gICAgICB9LFxuICAgICAgaW5zcGVjdDogZnVuY3Rpb24gKGRvY3R5cGUsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgb3V0cHV0LmNvZGUoJzwhRE9DVFlQRSAnICsgZG9jdHlwZS5uYW1lICsgJz4nLCAnaHRtbCcpO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS50b1N0cmluZygpID09PSBiLnRvU3RyaW5nKCk7XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZikge1xuICAgICAgICB2YXIgZCA9IGRpZmYoJzwhRE9DVFlQRSAnICsgYWN0dWFsLm5hbWUgKyAnPicsICc8IURPQ1RZUEUgJyArIGV4cGVjdGVkLm5hbWUgKyAnPicpO1xuICAgICAgICBkLmlubGluZSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxEb2N1bWVudCcsXG4gICAgICBiYXNlOiAnRE9NTm9kZScsXG4gICAgICBpZGVudGlmeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gOSAmJiBvYmouZG9jdW1lbnRFbGVtZW50ICYmIG9iai5pbXBsZW1lbnRhdGlvbjtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZG9jdW1lbnQsIGRlcHRoLCBvdXRwdXQsIGluc3BlY3QpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgZG9jdW1lbnQuY2hpbGROb2Rlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICBvdXRwdXQuYXBwZW5kKGluc3BlY3QoZG9jdW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGlmZjogZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgZGlmZjogb3V0cHV0XG4gICAgICAgIH07XG4gICAgICAgIGRpZmZOb2RlTGlzdHMoYWN0dWFsLmNoaWxkTm9kZXMsIGV4cGVjdGVkLmNoaWxkTm9kZXMsIG91dHB1dCwgZGlmZiwgaW5zcGVjdCwgZXF1YWwpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZFR5cGUoe1xuICAgICAgbmFtZTogJ0hUTUxFbGVtZW50JyxcbiAgICAgIGJhc2U6ICdET01Ob2RlJyxcbiAgICAgIGlkZW50aWZ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxICYmIG9iai5ub2RlTmFtZSAmJiBvYmouYXR0cmlidXRlcyAmJiBvYmoub3V0ZXJIVE1MO1xuICAgICAgfSxcbiAgICAgIGVxdWFsOiBmdW5jdGlvbiAoYSwgYiwgZXF1YWwpIHtcbiAgICAgICAgcmV0dXJuIGEubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gYi5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICYmIGVxdWFsKGdldEF0dHJpYnV0ZXMoYSksIGdldEF0dHJpYnV0ZXMoYikpICYmIGVxdWFsKGEuY2hpbGROb2RlcywgYi5jaGlsZE5vZGVzKTtcbiAgICAgIH0sXG4gICAgICBpbnNwZWN0OiBmdW5jdGlvbiAoZWxlbWVudCwgZGVwdGgsIG91dHB1dCwgaW5zcGVjdCkge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBzdGFydFRhZyA9IHN0cmluZ2lmeVN0YXJ0VGFnKGVsZW1lbnQpO1xuXG4gICAgICAgIHZhciBpbnNwZWN0ZWRDaGlsZHJlbiA9IFtdO1xuICAgICAgICBpZiAoZWxlbWVudE5hbWUgPT09ICdzY3JpcHQnKSB7XG4gICAgICAgICAgdmFyIHR5cGUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpO1xuICAgICAgICAgIGlmICghdHlwZSB8fCAvamF2YXNjcmlwdC8udGVzdCh0eXBlKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdqYXZhc2NyaXB0JztcbiAgICAgICAgICB9XG4gICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4ucHVzaChvdXRwdXQuY2xvbmUoKS5jb2RlKGVsZW1lbnQudGV4dENvbnRlbnQsIHR5cGUpKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50TmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLnB1c2gob3V0cHV0LmNsb25lKCkuY29kZShlbGVtZW50LnRleHRDb250ZW50LCBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpIHx8ICd0ZXh0L2NzcycpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoIDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpbnNwZWN0ZWRDaGlsZHJlbi5wdXNoKGluc3BlY3QoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHdpZHRoID0gMDtcbiAgICAgICAgdmFyIG11bHRpcGxlTGluZXMgPSBpbnNwZWN0ZWRDaGlsZHJlbi5zb21lKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgdmFyIHNpemUgPSBvLnNpemUoKTtcbiAgICAgICAgICB3aWR0aCArPSBzaXplLndpZHRoO1xuICAgICAgICAgIHJldHVybiB3aWR0aCA+IDUwIHx8IG8uaGVpZ2h0ID4gMTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb3V0cHV0LmNvZGUoc3RhcnRUYWcsICdodG1sJyk7XG4gICAgICAgIGlmIChlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgaWYgKG11bHRpcGxlTGluZXMpIHtcbiAgICAgICAgICAgIG91dHB1dC5ubCgpLmluZGVudExpbmVzKCk7XG5cbiAgICAgICAgICAgIGluc3BlY3RlZENoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGluc3BlY3RlZENoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICBvdXRwdXQuaSgpLmJsb2NrKGluc3BlY3RlZENoaWxkKS5ubCgpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG91dHB1dC5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zcGVjdGVkQ2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAoaW5zcGVjdGVkQ2hpbGQsIGluZGV4KSB7XG4gICAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoaW5zcGVjdGVkQ2hpbGQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG91dHB1dC5jb2RlKHN0cmluZ2lmeUVuZFRhZyhlbGVtZW50KSwgJ2h0bWwnKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH0sXG4gICAgICBkaWZmTGltaXQ6IDUxMixcbiAgICAgIGRpZmY6IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgICAgZGlmZjogb3V0cHV0LFxuICAgICAgICAgIGlubGluZTogdHJ1ZVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpID4gdGhpcy5kaWZmTGltaXQpIHtcbiAgICAgICAgICByZXN1bHQuZGlmZi5qc0NvbW1lbnQoJ0RpZmYgc3VwcHJlc3NlZCBkdWUgdG8gc2l6ZSA+ICcgKyB0aGlzLmRpZmZMaW1pdCk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbXB0eUVsZW1lbnRzID0gYWN0dWFsLmNoaWxkTm9kZXMubGVuZ3RoID09PSAwICYmIGV4cGVjdGVkLmNoaWxkTm9kZXMubGVuZ3RoID09PSAwO1xuICAgICAgICB2YXIgY29uZmxpY3RpbmdFbGVtZW50ID0gYWN0dWFsLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgIT09IGV4cGVjdGVkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgfHwgIWVxdWFsKGdldEF0dHJpYnV0ZXMoYWN0dWFsKSwgZ2V0QXR0cmlidXRlcyhleHBlY3RlZCkpO1xuXG4gICAgICAgIGlmICghY29uZmxpY3RpbmdFbGVtZW50KSB7XG4gICAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5U3RhcnRUYWcoYWN0dWFsKSwgJ2h0bWwnKTtcbiAgICAgICAgfSBlbHNlIGlmICghZW1wdHlFbGVtZW50cykge1xuICAgICAgICAgIG91dHB1dC5hcHBlbmQoZGlmZihzdHJpbmdpZnlTdGFydFRhZyhhY3R1YWwpLCBzdHJpbmdpZnlTdGFydFRhZyhleHBlY3RlZCkpLmRpZmYpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbXB0eUVsZW1lbnRzKSB7XG4gICAgICAgICAgb3V0cHV0Lm5sKCkuaW5kZW50TGluZXMoKTtcbiAgICAgICAgICBkaWZmTm9kZUxpc3RzKGFjdHVhbC5jaGlsZE5vZGVzLCBleHBlY3RlZC5jaGlsZE5vZGVzLCBvdXRwdXQsIGRpZmYsIGluc3BlY3QsIGVxdWFsKTtcbiAgICAgICAgICBvdXRwdXQubmwoKS5vdXRkZW50TGluZXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbXB0eUVsZW1lbnRzICYmIGNvbmZsaWN0aW5nRWxlbWVudCkge1xuICAgICAgICAgIG91dHB1dC5hcHBlbmQoZGlmZihzdHJpbmdpZnlTdGFydFRhZyhhY3R1YWwpICsgc3RyaW5naWZ5RW5kVGFnKGFjdHVhbCksIHN0cmluZ2lmeVN0YXJ0VGFnKGV4cGVjdGVkKSArIHN0cmluZ2lmeUVuZFRhZyhleHBlY3RlZCkpLmRpZmYpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChhY3R1YWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gZXhwZWN0ZWQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgb3V0cHV0LmNvZGUoc3RyaW5naWZ5RW5kVGFnKGFjdHVhbCksICdodG1sJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG91dHB1dC5hcHBlbmQoZGlmZihzdHJpbmdpZnlFbmRUYWcoYWN0dWFsKSwgc3RyaW5naWZ5RW5kVGFnKGV4cGVjdGVkKSkuZGlmZik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cGVjdC5hZGRBc3NlcnRpb24oJ0hUTUxFbGVtZW50JywgJ3RvIFtvbmx5XSBoYXZlIChhdHRyaWJ1dGV8YXR0cmlidXRlcyknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBjbXApIHtcbiAgICAgIHZhciBhdHRycyA9IGdldEF0dHJpYnV0ZXMoc3ViamVjdCk7XG4gICAgICB2YXIgY21wQ2xhc3NlcztcblxuICAgICAgaWYgKHR5cGVvZiBjbXAgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNtcCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICB9XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGNtcCkpIHtcbiAgICAgICAgZXhwZWN0KGF0dHJzLCAndG8gW29ubHldIGhhdmUga2V5cycsIGNtcCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjbXAgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRoaXMuZmxhZ3MuZXhoYXVzdGl2ZWx5ID0gdGhpcy5mbGFncy5vbmx5O1xuXG4gICAgICAgIHZhciBjb21wYXJhdG9yID0gZXh0ZW5kKHt9LCBjbXApO1xuXG4gICAgICAgIGlmIChjbXBbJ2NsYXNzJ10pIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGNtcFsnY2xhc3MnXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNtcENsYXNzZXMgPSBjbXBbJ2NsYXNzJ10uc3BsaXQoJyAnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY21wQ2xhc3NlcyA9IGNtcFsnY2xhc3MnXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5mbGFncy5leGhhdXN0aXZlbHkpIHtcbiAgICAgICAgICBpZiAoY21wWydjbGFzcyddKSB7XG4gICAgICAgICAgICB2YXIgY21wQ2xhc3Nlc0NvcHkgPSBjbXBDbGFzc2VzLnNsaWNlKCk7XG4gICAgICAgICAgICBjbXBDbGFzc2VzID0gW107XG4gICAgICAgICAgICBhdHRyc1snY2xhc3MnXS5mb3JFYWNoKGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgICAgICAgdmFyIGlkeCA9IGNtcENsYXNzZXNDb3B5LmluZGV4T2YoY2xhc3NOYW1lKTtcblxuICAgICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGNtcENsYXNzZXMucHVzaChjbXBDbGFzc2VzQ29weS5zcGxpY2UoaWR4LCAxKVswXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjbXBDbGFzc2VzID0gY21wQ2xhc3Nlcy5jb25jYXQoY21wQ2xhc3Nlc0NvcHkpO1xuXG4gICAgICAgICAgICBpZiAoY21wWydjbGFzcyddKSB7XG4gICAgICAgICAgICAgIGNvbXBhcmF0b3JbJ2NsYXNzJ10gPSBjbXBDbGFzc2VzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBleHBlY3QoYXR0cnMsICd0byBbZXhoYXVzdGl2ZWx5XSBzYXRpc2Z5JywgY29tcGFyYXRvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGNtcFsnY2xhc3MnXSkge1xuICAgICAgICAgICAgY29tcGFyYXRvclsnY2xhc3MnXSA9IGV4cGVjdC5pdC5hcHBseShudWxsLCBbJ3RvIGNvbnRhaW4nXS5jb25jYXQoY21wQ2xhc3NlcykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBleHBlY3QoYXR0cnMsICd0byBzYXRpc2Z5JywgY29tcGFyYXRvcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHN1cHBseSBlaXRoZXIgc3RyaW5ncywgYXJyYXksIG9yIG9iamVjdCcpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignSFRNTEVsZW1lbnQnLCAndG8gaGF2ZSBbbm9dIChjaGlsZHxjaGlsZHJlbiknLCBmdW5jdGlvbiAoZXhwZWN0LCBzdWJqZWN0LCBxdWVyeSwgY21wKSB7XG4gICAgICBpZiAodGhpcy5mbGFncy5ubykge1xuICAgICAgICB0aGlzLmVycm9yTW9kZSA9ICduZXN0ZWQnO1xuICAgICAgICByZXR1cm4gZXhwZWN0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHN1YmplY3QuY2hpbGROb2RlcyksICd0byBiZSBhbiBlbXB0eSBhcnJheScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc3ViamVjdC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KSk7XG4gICAgICAgIHRocm93IGNoaWxkcmVuO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignSFRNTEVsZW1lbnQnLCAndG8gaGF2ZSB0ZXh0JywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHJldHVybiBleHBlY3Qoc3ViamVjdC50ZXh0Q29udGVudCwgJ3RvIHNhdGlzZnknLCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICBleHBlY3QuYWRkQXNzZXJ0aW9uKFsnSFRNTERvY3VtZW50JywgJ0hUTUxFbGVtZW50J10sICdxdWVyaWVkIGZvciBbZmlyc3RdJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCwgdmFsdWUpIHtcbiAgICAgIHZhciBxdWVyeVJlc3VsdDtcbiAgICAgIGlmICh0aGlzLmZsYWdzLmZpcnN0KSB7XG4gICAgICAgIHF1ZXJ5UmVzdWx0ID0gc3ViamVjdC5xdWVyeVNlbGVjdG9yKHZhbHVlKTtcbiAgICAgICAgaWYgKCFxdWVyeVJlc3VsdCkge1xuICAgICAgICAgIHRoaXMuZXJyb3JNb2RlID0gJ25lc3RlZCc7XG4gICAgICAgICAgZXhwZWN0LmZhaWwoZnVuY3Rpb24gKG91dHB1dCkge1xuICAgICAgICAgICAgb3V0cHV0LmVycm9yKCdUaGUgc2VsZWN0b3InKS5zcCgpLmpzU3RyaW5nKHZhbHVlKS5zcCgpLmVycm9yKCd5aWVsZGVkIG5vIHJlc3VsdHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcXVlcnlSZXN1bHQgPSBzdWJqZWN0LnF1ZXJ5U2VsZWN0b3JBbGwodmFsdWUpO1xuICAgICAgICBpZiAocXVlcnlSZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5lcnJvck1vZGUgPSAnbmVzdGVkJztcbiAgICAgICAgICBleHBlY3QuZmFpbChmdW5jdGlvbiAob3V0cHV0KSB7XG4gICAgICAgICAgICBvdXRwdXQuZXJyb3IoJ1RoZSBzZWxlY3RvcicpLnNwKCkuanNTdHJpbmcodmFsdWUpLnNwKCkuZXJyb3IoJ3lpZWxkZWQgbm8gcmVzdWx0cycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNoaWZ0KGV4cGVjdCwgcXVlcnlSZXN1bHQsIDEpO1xuICAgIH0pO1xuXG4gICAgZXhwZWN0LmFkZEFzc2VydGlvbignc3RyaW5nJywgJ3doZW4gcGFyc2VkIGFzIChodG1sfEhUTUwpJywgZnVuY3Rpb24gKGV4cGVjdCwgc3ViamVjdCkge1xuICAgICAgdmFyIGh0bWxEb2N1bWVudDtcbiAgICAgIGlmICh0eXBlb2YgRE9NUGFyc2VyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBodG1sRG9jdW1lbnQgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHN1YmplY3QsICd0ZXh0L2h0bWwnKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbiAmJiBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVIVE1MRG9jdW1lbnQpIHtcbiAgICAgICAgaHRtbERvY3VtZW50ID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KCcnKTtcbiAgICAgICAgaHRtbERvY3VtZW50Lm9wZW4oKTtcbiAgICAgICAgaHRtbERvY3VtZW50LndyaXRlKHN1YmplY3QpO1xuICAgICAgICBodG1sRG9jdW1lbnQuY2xvc2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaHRtbERvY3VtZW50ID0gcmVxdWlyZSgnanNkb20nKS5qc2RvbShzdWJqZWN0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYXNzZXJ0aW9uIGB3aGVuIHBhcnNlZCBhcyBodG1sYCB3YXMgcnVuIG91dHNpZGUgYSBicm93c2VyLCBidXQgY291bGQgbm90IGZpbmQgdGhlIGBqc2RvbWAgbW9kdWxlLiBQbGVhc2UgbnBtIGluc3RhbGwganNkb20gdG8gbWFrZSB0aGlzIHdvcmsuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnNoaWZ0KGV4cGVjdCwgaHRtbERvY3VtZW50LCAwKTtcbiAgICB9KTtcbiAgfVxufTtcbiIsInZhciBhcnJheURpZmYgPSByZXF1aXJlKCdhcnJheWRpZmYnKTtcblxuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCkge1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhcnJheUNoYW5nZXMoYWN0dWFsLCBleHBlY3RlZCwgZXF1YWwsIHNpbWlsYXIpIHtcbiAgICB2YXIgbXV0YXRlZEFycmF5ID0gbmV3IEFycmF5KGFjdHVhbC5sZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBhY3R1YWwubGVuZ3RoOyBrICs9IDEpIHtcbiAgICAgICAgbXV0YXRlZEFycmF5W2tdID0ge1xuICAgICAgICAgICAgdHlwZTogJ3NpbWlsYXInLFxuICAgICAgICAgICAgdmFsdWU6IGFjdHVhbFtrXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmIChtdXRhdGVkQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICBtdXRhdGVkQXJyYXlbbXV0YXRlZEFycmF5Lmxlbmd0aCAtIDFdLmxhc3QgPSB0cnVlO1xuICAgIH1cblxuICAgIHNpbWlsYXIgPSBzaW1pbGFyIHx8IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgdmFyIGl0ZW1zRGlmZiA9IGFycmF5RGlmZihhY3R1YWwsIGV4cGVjdGVkLCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gZXF1YWwoYSwgYikgfHwgc2ltaWxhcihhLCBiKTtcbiAgICB9KTtcblxuICAgIHZhciByZW1vdmVUYWJsZSA9IFtdO1xuICAgIGZ1bmN0aW9uIG9mZnNldEluZGV4KGluZGV4KSB7XG4gICAgICAgIHJldHVybiBpbmRleCArIChyZW1vdmVUYWJsZVtpbmRleCAtIDFdIHx8IDApO1xuICAgIH1cblxuICAgIHZhciByZW1vdmVzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdyZW1vdmUnO1xuICAgIH0pO1xuXG4gICAgdmFyIHJlbW92ZXNCeUluZGV4ID0ge307XG4gICAgdmFyIHJlbW92ZWRJdGVtcyA9IDA7XG4gICAgcmVtb3Zlcy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgcmVtb3ZlSW5kZXggPSByZW1vdmVkSXRlbXMgKyBkaWZmSXRlbS5pbmRleDtcbiAgICAgICAgbXV0YXRlZEFycmF5LnNsaWNlKHJlbW92ZUluZGV4LCBkaWZmSXRlbS5ob3dNYW55ICsgcmVtb3ZlSW5kZXgpLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHYudHlwZSA9ICdyZW1vdmUnO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVtb3ZlZEl0ZW1zICs9IGRpZmZJdGVtLmhvd01hbnk7XG4gICAgICAgIHJlbW92ZXNCeUluZGV4W2RpZmZJdGVtLmluZGV4XSA9IHJlbW92ZWRJdGVtcztcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZVJlbW92ZVRhYmxlKCkge1xuICAgICAgICByZW1vdmVkSXRlbXMgPSAwO1xuICAgICAgICBhY3R1YWwuZm9yRWFjaChmdW5jdGlvbiAoXywgaW5kZXgpIHtcbiAgICAgICAgICAgIHJlbW92ZWRJdGVtcyArPSByZW1vdmVzQnlJbmRleFtpbmRleF0gfHwgMDtcbiAgICAgICAgICAgIHJlbW92ZVRhYmxlW2luZGV4XSA9IHJlbW92ZWRJdGVtcztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdXBkYXRlUmVtb3ZlVGFibGUoKTtcblxuICAgIHZhciBtb3ZlcyA9IGl0ZW1zRGlmZi5maWx0ZXIoZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIHJldHVybiBkaWZmSXRlbS50eXBlID09PSAnbW92ZSc7XG4gICAgfSk7XG5cbiAgICB2YXIgbW92ZWRJdGVtcyA9IDA7XG4gICAgbW92ZXMuZm9yRWFjaChmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgdmFyIG1vdmVGcm9tSW5kZXggPSBvZmZzZXRJbmRleChkaWZmSXRlbS5mcm9tKTtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSBtdXRhdGVkQXJyYXkuc2xpY2UobW92ZUZyb21JbmRleCwgZGlmZkl0ZW0uaG93TWFueSArIG1vdmVGcm9tSW5kZXgpO1xuICAgICAgICB2YXIgYWRkZWQgPSByZW1vdmVkLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgcmV0dXJuIGV4dGVuZCh7fSwgdiwgeyBsYXN0OiBmYWxzZSwgdHlwZTogJ2luc2VydCcgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHYudHlwZSA9ICdyZW1vdmUnO1xuICAgICAgICB9KTtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShtdXRhdGVkQXJyYXksIFtvZmZzZXRJbmRleChkaWZmSXRlbS50byksIDBdLmNvbmNhdChhZGRlZCkpO1xuICAgICAgICBtb3ZlZEl0ZW1zICs9IGRpZmZJdGVtLmhvd01hbnk7XG4gICAgICAgIHJlbW92ZXNCeUluZGV4W2RpZmZJdGVtLmZyb21dID0gbW92ZWRJdGVtcztcbiAgICAgICAgdXBkYXRlUmVtb3ZlVGFibGUoKTtcbiAgICB9KTtcblxuICAgIHZhciBpbnNlcnRzID0gaXRlbXNEaWZmLmZpbHRlcihmdW5jdGlvbiAoZGlmZkl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGRpZmZJdGVtLnR5cGUgPT09ICdpbnNlcnQnO1xuICAgIH0pO1xuXG4gICAgaW5zZXJ0cy5mb3JFYWNoKGZ1bmN0aW9uIChkaWZmSXRlbSkge1xuICAgICAgICB2YXIgYWRkZWQgPSBuZXcgQXJyYXkoZGlmZkl0ZW0udmFsdWVzLmxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGRpZmZJdGVtLnZhbHVlcy5sZW5ndGggOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGFkZGVkW2ldID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBkaWZmSXRlbS52YWx1ZXNbaV1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShtdXRhdGVkQXJyYXksIFtvZmZzZXRJbmRleChkaWZmSXRlbS5pbmRleCksIDBdLmNvbmNhdChhZGRlZCkpO1xuICAgIH0pO1xuXG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgbXV0YXRlZEFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtLCBpbmRleCkge1xuICAgICAgICB2YXIgdHlwZSA9IGRpZmZJdGVtLnR5cGU7XG4gICAgICAgIGlmICh0eXBlID09PSAncmVtb3ZlJykge1xuICAgICAgICAgICAgb2Zmc2V0IC09IDE7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3NpbWlsYXInKSB7XG4gICAgICAgICAgICBkaWZmSXRlbS5leHBlY3RlZCA9IGV4cGVjdGVkW29mZnNldCArIGluZGV4XTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIGNvbmZsaWN0cyA9IG11dGF0ZWRBcnJheS5yZWR1Y2UoZnVuY3Rpb24gKGNvbmZsaWN0cywgaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS50eXBlID09PSAnc2ltaWxhcicgPyBjb25mbGljdHMgOiBjb25mbGljdHMgKyAxO1xuICAgIH0sIDApO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGMgPSAwOyBpIDwgTWF0aC5tYXgoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKSAmJiAgYyA8PSBjb25mbGljdHM7IGkgKz0gMSkge1xuICAgICAgICB2YXIgZXhwZWN0ZWRUeXBlID0gdHlwZW9mIGV4cGVjdGVkW2ldO1xuICAgICAgICB2YXIgYWN0dWFsVHlwZSA9IHR5cGVvZiBhY3R1YWxbaV07XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgYWN0dWFsVHlwZSAhPT0gZXhwZWN0ZWRUeXBlIHx8XG4gICAgICAgICAgICAgICAgKChhY3R1YWxUeXBlID09PSAnb2JqZWN0JyB8fCBhY3R1YWxUeXBlID09PSAnc3RyaW5nJykgJiYgIXNpbWlsYXIoYWN0dWFsW2ldLCBleHBlY3RlZFtpXSkpIHx8XG4gICAgICAgICAgICAgICAgKGFjdHVhbFR5cGUgIT09ICdvYmplY3QnICYmIGFjdHVhbFR5cGUgIT09ICdzdHJpbmcnICYmICFlcXVhbChhY3R1YWxbaV0sIGV4cGVjdGVkW2ldKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBjICs9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYyA8PSBjb25mbGljdHMpIHtcbiAgICAgICAgbXV0YXRlZEFycmF5ID0gW107XG4gICAgICAgIHZhciBqO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgTWF0aC5taW4oYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTsgaiArPSAxKSB7XG4gICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3NpbWlsYXInLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBhY3R1YWxbal0sXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkW2pdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhY3R1YWwubGVuZ3RoIDwgZXhwZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKDsgaiA8IE1hdGgubWF4KGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIG11dGF0ZWRBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBleHBlY3RlZFtqXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICg7IGogPCBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpOyBqICs9IDEpIHtcbiAgICAgICAgICAgICAgICBtdXRhdGVkQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogYWN0dWFsW2pdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG11dGF0ZWRBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBtdXRhdGVkQXJyYXlbbXV0YXRlZEFycmF5Lmxlbmd0aCAtIDFdLmxhc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbXV0YXRlZEFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRpZmZJdGVtKSB7XG4gICAgICAgIGlmIChkaWZmSXRlbS50eXBlID09PSAnc2ltaWxhcicgJiYgZXF1YWwoZGlmZkl0ZW0udmFsdWUsIGRpZmZJdGVtLmV4cGVjdGVkKSkge1xuICAgICAgICAgICAgZGlmZkl0ZW0udHlwZSA9ICdlcXVhbCc7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtdXRhdGVkQXJyYXk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBhcnJheURpZmY7XG5cbi8vIEJhc2VkIG9uIHNvbWUgcm91Z2ggYmVuY2htYXJraW5nLCB0aGlzIGFsZ29yaXRobSBpcyBhYm91dCBPKDJuKSB3b3JzdCBjYXNlLFxuLy8gYW5kIGl0IGNhbiBjb21wdXRlIGRpZmZzIG9uIHJhbmRvbSBhcnJheXMgb2YgbGVuZ3RoIDEwMjQgaW4gYWJvdXQgMzRtcyxcbi8vIHRob3VnaCBqdXN0IGEgZmV3IGNoYW5nZXMgb24gYW4gYXJyYXkgb2YgbGVuZ3RoIDEwMjQgdGFrZXMgYWJvdXQgMC41bXNcblxuYXJyYXlEaWZmLkluc2VydERpZmYgPSBJbnNlcnREaWZmO1xuYXJyYXlEaWZmLlJlbW92ZURpZmYgPSBSZW1vdmVEaWZmO1xuYXJyYXlEaWZmLk1vdmVEaWZmID0gTW92ZURpZmY7XG5cbmZ1bmN0aW9uIEluc2VydERpZmYoaW5kZXgsIHZhbHVlcykge1xuICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gIHRoaXMudmFsdWVzID0gdmFsdWVzO1xufVxuSW5zZXJ0RGlmZi5wcm90b3R5cGUudHlwZSA9ICdpbnNlcnQnO1xuSW5zZXJ0RGlmZi5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogdGhpcy50eXBlXG4gICwgaW5kZXg6IHRoaXMuaW5kZXhcbiAgLCB2YWx1ZXM6IHRoaXMudmFsdWVzXG4gIH07XG59O1xuXG5mdW5jdGlvbiBSZW1vdmVEaWZmKGluZGV4LCBob3dNYW55KSB7XG4gIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgdGhpcy5ob3dNYW55ID0gaG93TWFueTtcbn1cblJlbW92ZURpZmYucHJvdG90eXBlLnR5cGUgPSAncmVtb3ZlJztcblJlbW92ZURpZmYucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IHRoaXMudHlwZVxuICAsIGluZGV4OiB0aGlzLmluZGV4XG4gICwgaG93TWFueTogdGhpcy5ob3dNYW55XG4gIH07XG59O1xuXG5mdW5jdGlvbiBNb3ZlRGlmZihmcm9tLCB0bywgaG93TWFueSkge1xuICB0aGlzLmZyb20gPSBmcm9tO1xuICB0aGlzLnRvID0gdG87XG4gIHRoaXMuaG93TWFueSA9IGhvd01hbnk7XG59XG5Nb3ZlRGlmZi5wcm90b3R5cGUudHlwZSA9ICdtb3ZlJztcbk1vdmVEaWZmLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiB0aGlzLnR5cGVcbiAgLCBmcm9tOiB0aGlzLmZyb21cbiAgLCB0bzogdGhpcy50b1xuICAsIGhvd01hbnk6IHRoaXMuaG93TWFueVxuICB9O1xufTtcblxuZnVuY3Rpb24gc3RyaWN0RXF1YWwoYSwgYikge1xuICByZXR1cm4gYSA9PT0gYjtcbn1cblxuZnVuY3Rpb24gYXJyYXlEaWZmKGJlZm9yZSwgYWZ0ZXIsIGVxdWFsRm4pIHtcbiAgaWYgKCFlcXVhbEZuKSBlcXVhbEZuID0gc3RyaWN0RXF1YWw7XG5cbiAgLy8gRmluZCBhbGwgaXRlbXMgaW4gYm90aCB0aGUgYmVmb3JlIGFuZCBhZnRlciBhcnJheSwgYW5kIHJlcHJlc2VudCB0aGVtXG4gIC8vIGFzIG1vdmVzLiBNYW55IG9mIHRoZXNlIFwibW92ZXNcIiBtYXkgZW5kIHVwIGJlaW5nIGRpc2NhcmRlZCBpbiB0aGUgbGFzdFxuICAvLyBwYXNzIGlmIHRoZXkgYXJlIGZyb20gYW4gaW5kZXggdG8gdGhlIHNhbWUgaW5kZXgsIGJ1dCB3ZSBkb24ndCBrbm93IHRoaXNcbiAgLy8gdXAgZnJvbnQsIHNpbmNlIHdlIGhhdmVuJ3QgeWV0IG9mZnNldCB0aGUgaW5kaWNlcy5cbiAgLy8gXG4gIC8vIEFsc28ga2VlcCBhIG1hcCBvZiBhbGwgdGhlIGluZGljaWVzIGFjY291bnRlZCBmb3IgaW4gdGhlIGJlZm9yZSBhbmQgYWZ0ZXJcbiAgLy8gYXJyYXlzLiBUaGVzZSBtYXBzIGFyZSB1c2VkIG5leHQgdG8gY3JlYXRlIGluc2VydCBhbmQgcmVtb3ZlIGRpZmZzLlxuICB2YXIgYmVmb3JlTGVuZ3RoID0gYmVmb3JlLmxlbmd0aDtcbiAgdmFyIGFmdGVyTGVuZ3RoID0gYWZ0ZXIubGVuZ3RoO1xuICB2YXIgbW92ZXMgPSBbXTtcbiAgdmFyIGJlZm9yZU1hcmtlZCA9IHt9O1xuICB2YXIgYWZ0ZXJNYXJrZWQgPSB7fTtcbiAgZm9yICh2YXIgYmVmb3JlSW5kZXggPSAwOyBiZWZvcmVJbmRleCA8IGJlZm9yZUxlbmd0aDsgYmVmb3JlSW5kZXgrKykge1xuICAgIHZhciBiZWZvcmVJdGVtID0gYmVmb3JlW2JlZm9yZUluZGV4XTtcbiAgICBmb3IgKHZhciBhZnRlckluZGV4ID0gMDsgYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoOyBhZnRlckluZGV4KyspIHtcbiAgICAgIGlmIChhZnRlck1hcmtlZFthZnRlckluZGV4XSkgY29udGludWU7XG4gICAgICBpZiAoIWVxdWFsRm4oYmVmb3JlSXRlbSwgYWZ0ZXJbYWZ0ZXJJbmRleF0pKSBjb250aW51ZTtcbiAgICAgIHZhciBmcm9tID0gYmVmb3JlSW5kZXg7XG4gICAgICB2YXIgdG8gPSBhZnRlckluZGV4O1xuICAgICAgdmFyIGhvd01hbnkgPSAwO1xuICAgICAgZG8ge1xuICAgICAgICBiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXgrK10gPSBhZnRlck1hcmtlZFthZnRlckluZGV4KytdID0gdHJ1ZTtcbiAgICAgICAgaG93TWFueSsrO1xuICAgICAgfSB3aGlsZSAoXG4gICAgICAgIGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoICYmXG4gICAgICAgIGFmdGVySW5kZXggPCBhZnRlckxlbmd0aCAmJlxuICAgICAgICBlcXVhbEZuKGJlZm9yZVtiZWZvcmVJbmRleF0sIGFmdGVyW2FmdGVySW5kZXhdKSAmJlxuICAgICAgICAhYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF1cbiAgICAgICk7XG4gICAgICBtb3Zlcy5wdXNoKG5ldyBNb3ZlRGlmZihmcm9tLCB0bywgaG93TWFueSkpO1xuICAgICAgYmVmb3JlSW5kZXgtLTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIENyZWF0ZSBhIHJlbW92ZSBmb3IgYWxsIG9mIHRoZSBpdGVtcyBpbiB0aGUgYmVmb3JlIGFycmF5IHRoYXQgd2VyZVxuICAvLyBub3QgbWFya2VkIGFzIGJlaW5nIG1hdGNoZWQgaW4gdGhlIGFmdGVyIGFycmF5IGFzIHdlbGxcbiAgdmFyIHJlbW92ZXMgPSBbXTtcbiAgZm9yIChiZWZvcmVJbmRleCA9IDA7IGJlZm9yZUluZGV4IDwgYmVmb3JlTGVuZ3RoOykge1xuICAgIGlmIChiZWZvcmVNYXJrZWRbYmVmb3JlSW5kZXhdKSB7XG4gICAgICBiZWZvcmVJbmRleCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IGJlZm9yZUluZGV4O1xuICAgIHZhciBob3dNYW55ID0gMDtcbiAgICB3aGlsZSAoYmVmb3JlSW5kZXggPCBiZWZvcmVMZW5ndGggJiYgIWJlZm9yZU1hcmtlZFtiZWZvcmVJbmRleCsrXSkge1xuICAgICAgaG93TWFueSsrO1xuICAgIH1cbiAgICByZW1vdmVzLnB1c2gobmV3IFJlbW92ZURpZmYoaW5kZXgsIGhvd01hbnkpKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSBhbiBpbnNlcnQgZm9yIGFsbCBvZiB0aGUgaXRlbXMgaW4gdGhlIGFmdGVyIGFycmF5IHRoYXQgd2VyZVxuICAvLyBub3QgbWFya2VkIGFzIGJlaW5nIG1hdGNoZWQgaW4gdGhlIGJlZm9yZSBhcnJheSBhcyB3ZWxsXG4gIHZhciBpbnNlcnRzID0gW107XG4gIGZvciAoYWZ0ZXJJbmRleCA9IDA7IGFmdGVySW5kZXggPCBhZnRlckxlbmd0aDspIHtcbiAgICBpZiAoYWZ0ZXJNYXJrZWRbYWZ0ZXJJbmRleF0pIHtcbiAgICAgIGFmdGVySW5kZXgrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YXIgaW5kZXggPSBhZnRlckluZGV4O1xuICAgIHZhciBob3dNYW55ID0gMDtcbiAgICB3aGlsZSAoYWZ0ZXJJbmRleCA8IGFmdGVyTGVuZ3RoICYmICFhZnRlck1hcmtlZFthZnRlckluZGV4KytdKSB7XG4gICAgICBob3dNYW55Kys7XG4gICAgfVxuICAgIHZhciB2YWx1ZXMgPSBhZnRlci5zbGljZShpbmRleCwgaW5kZXggKyBob3dNYW55KTtcbiAgICBpbnNlcnRzLnB1c2gobmV3IEluc2VydERpZmYoaW5kZXgsIHZhbHVlcykpO1xuICB9XG5cbiAgdmFyIGluc2VydHNMZW5ndGggPSBpbnNlcnRzLmxlbmd0aDtcbiAgdmFyIHJlbW92ZXNMZW5ndGggPSByZW1vdmVzLmxlbmd0aDtcbiAgdmFyIG1vdmVzTGVuZ3RoID0gbW92ZXMubGVuZ3RoO1xuICB2YXIgaSwgajtcblxuICAvLyBPZmZzZXQgc3Vic2VxdWVudCByZW1vdmVzIGFuZCBtb3ZlcyBieSByZW1vdmVzXG4gIHZhciBjb3VudCA9IDA7XG4gIGZvciAoaSA9IDA7IGkgPCByZW1vdmVzTGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmVtb3ZlID0gcmVtb3Zlc1tpXTtcbiAgICByZW1vdmUuaW5kZXggLT0gY291bnQ7XG4gICAgY291bnQgKz0gcmVtb3ZlLmhvd01hbnk7XG4gICAgZm9yIChqID0gMDsgaiA8IG1vdmVzTGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBtb3ZlID0gbW92ZXNbal07XG4gICAgICBpZiAobW92ZS5mcm9tID49IHJlbW92ZS5pbmRleCkgbW92ZS5mcm9tIC09IHJlbW92ZS5ob3dNYW55O1xuICAgIH1cbiAgfVxuXG4gIC8vIE9mZnNldCBtb3ZlcyBieSBpbnNlcnRzXG4gIGZvciAoaSA9IGluc2VydHNMZW5ndGg7IGktLTspIHtcbiAgICB2YXIgaW5zZXJ0ID0gaW5zZXJ0c1tpXTtcbiAgICB2YXIgaG93TWFueSA9IGluc2VydC52YWx1ZXMubGVuZ3RoO1xuICAgIGZvciAoaiA9IG1vdmVzTGVuZ3RoOyBqLS07KSB7XG4gICAgICB2YXIgbW92ZSA9IG1vdmVzW2pdO1xuICAgICAgaWYgKG1vdmUudG8gPj0gaW5zZXJ0LmluZGV4KSBtb3ZlLnRvIC09IGhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT2Zmc2V0IHRoZSB0byBvZiBtb3ZlcyBieSBsYXRlciBtb3Zlc1xuICBmb3IgKGkgPSBtb3Zlc0xlbmd0aDsgaS0tID4gMTspIHtcbiAgICB2YXIgbW92ZSA9IG1vdmVzW2ldO1xuICAgIGlmIChtb3ZlLnRvID09PSBtb3ZlLmZyb20pIGNvbnRpbnVlO1xuICAgIGZvciAoaiA9IGk7IGotLTspIHtcbiAgICAgIHZhciBlYXJsaWVyID0gbW92ZXNbal07XG4gICAgICBpZiAoZWFybGllci50byA+PSBtb3ZlLnRvKSBlYXJsaWVyLnRvIC09IG1vdmUuaG93TWFueTtcbiAgICAgIGlmIChlYXJsaWVyLnRvID49IG1vdmUuZnJvbSkgZWFybGllci50byArPSBtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgLy8gT25seSBvdXRwdXQgbW92ZXMgdGhhdCBlbmQgdXAgaGF2aW5nIGFuIGVmZmVjdCBhZnRlciBvZmZzZXR0aW5nXG4gIHZhciBvdXRwdXRNb3ZlcyA9IFtdO1xuXG4gIC8vIE9mZnNldCB0aGUgZnJvbSBvZiBtb3ZlcyBieSBlYXJsaWVyIG1vdmVzXG4gIGZvciAoaSA9IDA7IGkgPCBtb3Zlc0xlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG1vdmUgPSBtb3Zlc1tpXTtcbiAgICBpZiAobW92ZS50byA9PT0gbW92ZS5mcm9tKSBjb250aW51ZTtcbiAgICBvdXRwdXRNb3Zlcy5wdXNoKG1vdmUpO1xuICAgIGZvciAoaiA9IGkgKyAxOyBqIDwgbW92ZXNMZW5ndGg7IGorKykge1xuICAgICAgdmFyIGxhdGVyID0gbW92ZXNbal07XG4gICAgICBpZiAobGF0ZXIuZnJvbSA+PSBtb3ZlLmZyb20pIGxhdGVyLmZyb20gLT0gbW92ZS5ob3dNYW55O1xuICAgICAgaWYgKGxhdGVyLmZyb20gPj0gbW92ZS50bykgbGF0ZXIuZnJvbSArPSBtb3ZlLmhvd01hbnk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlbW92ZXMuY29uY2F0KG91dHB1dE1vdmVzLCBpbnNlcnRzKTtcbn1cbiIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciB1bmRlZmluZWQ7XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuXHR2YXIgaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCA9IG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IucHJvdG90eXBlICYmIGhhc093bi5jYWxsKG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsICdpc1Byb3RvdHlwZU9mJyk7XG5cdC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3Rcblx0aWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7fVxuXG5cdHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHR2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG5cdFx0dGFyZ2V0ID0gYXJndW1lbnRzWzBdLFxuXHRcdGkgPSAxLFxuXHRcdGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG5cdFx0ZGVlcCA9IGZhbHNlO1xuXG5cdC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cblx0aWYgKHR5cGVvZiB0YXJnZXQgPT09ICdib29sZWFuJykge1xuXHRcdGRlZXAgPSB0YXJnZXQ7XG5cdFx0dGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuXHRcdC8vIHNraXAgdGhlIGJvb2xlYW4gYW5kIHRoZSB0YXJnZXRcblx0XHRpID0gMjtcblx0fSBlbHNlIGlmICgodHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcgJiYgdHlwZW9mIHRhcmdldCAhPT0gJ2Z1bmN0aW9uJykgfHwgdGFyZ2V0ID09IG51bGwpIHtcblx0XHR0YXJnZXQgPSB7fTtcblx0fVxuXG5cdGZvciAoOyBpIDwgbGVuZ3RoOyArK2kpIHtcblx0XHRvcHRpb25zID0gYXJndW1lbnRzW2ldO1xuXHRcdC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcblx0XHRpZiAob3B0aW9ucyAhPSBudWxsKSB7XG5cdFx0XHQvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG5cdFx0XHRmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuXHRcdFx0XHRzcmMgPSB0YXJnZXRbbmFtZV07XG5cdFx0XHRcdGNvcHkgPSBvcHRpb25zW25hbWVdO1xuXG5cdFx0XHRcdC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3Bcblx0XHRcdFx0aWYgKHRhcmdldCA9PT0gY29weSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG5cdFx0XHRcdGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG5cdFx0XHRcdFx0aWYgKGNvcHlJc0FycmF5KSB7XG5cdFx0XHRcdFx0XHRjb3B5SXNBcnJheSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgQXJyYXkuaXNBcnJheShzcmMpID8gc3JjIDogW107XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuXHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cblx0XHRcdFx0Ly8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNvcHkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGNvcHk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuXHRyZXR1cm4gdGFyZ2V0O1xufTtcblxuIl19
