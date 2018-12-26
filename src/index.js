/*global DOMParser*/
const matchesSelector = require('./matchesSelector');

function getJSDOM() {
  try {
    return require('' + 'jsdom');
  } catch (err) {
    throw new Error(
      'unexpected-dom: Running outside a browser (or in a browser without DOMParser), but could not find the `jsdom` module. Please npm install jsdom to make this work.'
    );
  }
}

function getHtmlDocument(str) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(str, 'text/html');
  } else if (
    typeof document !== 'undefined' &&
    document.implementation &&
    document.implementation.createHTMLDocument
  ) {
    const htmlDocument = document.implementation.createHTMLDocument('');
    htmlDocument.open();
    htmlDocument.write(str);
    htmlDocument.close();
    return htmlDocument;
  } else {
    const jsdom = getJSDOM();

    return jsdom.JSDOM
      ? new jsdom.JSDOM(str).window.document
      : jsdom.jsdom(str);
  }
}

function parseHtml(str, isFragment) {
  if (isFragment) {
    str = `<html><head></head><body>${str}</body></html>`;
  }
  const htmlDocument = getHtmlDocument(str);

  if (isFragment) {
    const body = htmlDocument.body;
    const documentFragment = htmlDocument.createDocumentFragment();
    if (body) {
      for (let i = 0; i < body.childNodes.length; i += 1) {
        documentFragment.appendChild(body.childNodes[i].cloneNode(true));
      }
    }
    return documentFragment;
  } else {
    return htmlDocument;
  }
}

function parseXml(str) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(str, 'text/xml');
  } else {
    const jsdom = getJSDOM();

    if (jsdom.JSDOM) {
      return new jsdom.JSDOM(str, { contentType: 'text/xml' }).window.document;
    } else {
      return jsdom.jsdom(str, { parsingMode: 'xml' });
    }
  }
}

// From html-minifier
const enumeratedAttributeValues = {
  draggable: ['true', 'false'] // defaults to 'auto'
};

const matchSimpleAttribute = /^(?:allowfullscreen|async|autofocus|autoplay|checked|compact|controls|declare|default|defaultchecked|defaultmuted|defaultselected|defer|disabled|enabled|formnovalidate|hidden|indeterminate|inert|ismap|itemscope|loop|multiple|muted|nohref|noresize|noshade|novalidate|nowrap|open|pauseonexit|readonly|required|reversed|scoped|seamless|selected|sortable|spellcheck|truespeed|typemustmatch|visible)$/i;

function isBooleanAttribute(attrName) {
  return matchSimpleAttribute.test(attrName);
}

function isEnumeratedAttribute(attrName) {
  return attrName in enumeratedAttributeValues;
}

function validateStyles(expect, str) {
  const invalidStyles = str
    .split(';')
    .filter(part => !/^\s*(\w|-)+\s*:\s*(\w|-)+\s*$|^$/.test(part));

  if (invalidStyles.length > 0) {
    expect.errorMode = 'nested';
    expect.fail(
      'Expectation contains invalid styles: {0}',
      invalidStyles.join(';')
    );
  }
}

function styleStringToObject(str) {
  const styles = {};

  str.split(';').forEach(rule => {
    const tuple = rule.split(':').map(part => part.trim());
    // Guard against empty touples
    if (tuple[0] && tuple[1]) {
      styles[tuple[0]] = tuple[1];
    }
  });

  return styles;
}

function getClassNamesFromAttributeValue(attributeValue) {
  if (attributeValue === null) {
    return [];
  }

  if (attributeValue === '') {
    return [];
  }

  const classNames = attributeValue.split(/\s+/);
  if (classNames.length === 1 && classNames[0] === '') {
    classNames.pop();
  }
  return classNames;
}

function isInsideHtmlDocument(node) {
  const ownerDocument =
    node.nodeType === 9 && node.documentElement && node.implementation
      ? node
      : node.ownerDocument;

  if (ownerDocument.contentType) {
    return ownerDocument.contentType === 'text/html';
  } else {
    return ownerDocument.toString() === '[object HTMLDocument]';
  }
}

function getAttributes(element) {
  const isHtml = isInsideHtmlDocument(element);
  const attrs = element.attributes;
  const result = {};

  for (let i = 0; i < attrs.length; i += 1) {
    if (attrs[i].name === 'class') {
      result[attrs[i].name] =
        (attrs[i].value && attrs[i].value.split(' ')) || [];
    } else if (attrs[i].name === 'style') {
      result[attrs[i].name] = styleStringToObject(attrs[i].value);
    } else {
      result[attrs[i].name] =
        isHtml && isBooleanAttribute(attrs[i].name)
          ? true
          : attrs[i].value || '';
    }
  }

  return result;
}

function getCanonicalAttributes(element) {
  const attrs = getAttributes(element);
  const result = {};

  Object.keys(attrs)
    .sort()
    .forEach(key => {
      result[key] = attrs[key];
    });

  return result;
}

function entitify(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function isVoidElement(elementName) {
  return /(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)/i.test(
    elementName
  );
}

function writeAttributeToMagicPen(output, attributeName, value, isHtml) {
  output.prismAttrName(attributeName);
  if (!isHtml || !isBooleanAttribute(attributeName)) {
    if (attributeName === 'class') {
      value = value.join(' ');
    } else if (attributeName === 'style') {
      value = Object.keys(value)
        .map(cssProp => `${cssProp}: ${value[cssProp]}`)
        .join('; ');
    }
    output
      .prismPunctuation('="')
      .prismAttrValue(entitify(value))
      .prismPunctuation('"');
  }
}

function stringifyAttribute(attributeName, value) {
  if (
    isBooleanAttribute(attributeName) ||
    isEnumeratedAttribute(attributeName)
  ) {
    return attributeName;
  } else if (attributeName === 'class') {
    return `class="${value.join(' ')}"`; // FIXME: entitify
  } else if (attributeName === 'style') {
    return `style="${Object.keys(value)
      // FIXME: entitify
      .map(cssProp => [cssProp, value[cssProp]].join(': '))
      .join('; ')}"`;
  } else {
    return `${attributeName}="${entitify(value)}"`;
  }
}

function stringifyStartTag(element) {
  const elementName =
    element.ownerDocument.contentType === 'text/html'
      ? element.nodeName.toLowerCase()
      : element.nodeName;
  let str = `<${elementName}`;
  const attrs = getCanonicalAttributes(element);

  Object.keys(attrs).forEach(key => {
    str += ` ${stringifyAttribute(key, attrs[key])}`;
  });

  str += '>';
  return str;
}

function stringifyEndTag(element) {
  const isHtml = isInsideHtmlDocument(element);
  const elementName = isHtml
    ? element.nodeName.toLowerCase()
    : element.nodeName;
  if (isHtml && isVoidElement(elementName) && element.childNodes.length === 0) {
    return '';
  } else {
    return `</${elementName}>`;
  }
}

module.exports = {
  name: 'unexpected-dom',
  installInto(expect) {
    expect = expect.child();
    expect.use(require('magicpen-prism'));

    function bubbleError(body) {
      return expect.withError(body, err => {
        err.errorMode = 'bubble';
        throw err;
      });
    }

    expect.exportType({
      name: 'DOMNode',
      base: 'object',
      identify(obj) {
        return (
          obj &&
          obj.nodeName &&
          [2, 3, 4, 5, 6, 7, 10, 11, 12].indexOf(obj.nodeType) > -1
        );
      },
      equal(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect(element, depth, output) {
        return output.code(
          `${element.nodeName} "${element.nodeValue}"`,
          'prism-string'
        );
      }
    });

    expect.exportType({
      name: 'DOMComment',
      base: 'DOMNode',
      identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 8;
      },
      equal(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect(element, depth, output) {
        return output.code(`<!--${element.nodeValue}-->`, 'html');
      },
      diff(actual, expected, output, diff, inspect, equal) {
        const d = diff(
          `<!--${actual.nodeValue}-->`,
          `<!--${expected.nodeValue}-->`
        );
        d.inline = true;
        return d;
      }
    });

    // Recognize <!-- ignore --> as a special subtype of DOMComment so it can be targeted by assertions:
    expect.exportType({
      name: 'DOMIgnoreComment',
      base: 'DOMComment',
      identify(obj) {
        return (
          this.baseType.identify(obj) && /^\s*ignore\s*$/.test(obj.nodeValue)
        );
      }
    });

    expect.exportType({
      name: 'DOMTextNode',
      base: 'DOMNode',
      identify(obj) {
        return obj && typeof obj.nodeType === 'number' && obj.nodeType === 3;
      },
      equal(a, b) {
        return a.nodeValue === b.nodeValue;
      },
      inspect(element, depth, output) {
        return output.code(entitify(element.nodeValue.trim()), 'html');
      },
      diff(actual, expected, output, diff, inspect, equal) {
        const d = diff(actual.nodeValue, expected.nodeValue);
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMNodeList',
      base: 'array-like',
      prefix(output) {
        return output.text('NodeList[');
      },
      suffix(output) {
        return output.text(']');
      },
      similar(a, b) {
        // Figure out whether a and b are "struturally similar" so they can be diffed inline.
        return (
          a.nodeType === 1 && b.nodeType === 1 && a.nodeName === b.nodeName
        );
      },
      identify(obj) {
        return (
          obj &&
          typeof obj.length === 'number' &&
          typeof obj.toString === 'function' &&
          typeof obj.item === 'function' &&
          // With jsdom 6+, nodeList.toString() comes out as '[object Object]', so fall back to the constructor name:
          (obj.toString().indexOf('NodeList') !== -1 ||
            (obj.constructor && obj.constructor.name === 'NodeList'))
        );
      }
    });

    // Fake type to make it possible to build 'to satisfy' diffs to be rendered inline:
    expect.exportType({
      name: 'attachedDOMNodeList',
      base: 'DOMNodeList',
      indent: false,
      prefix(output) {
        return output;
      },
      suffix(output) {
        return output;
      },
      delimiter(output) {
        return output;
      },
      identify(obj) {
        return obj && obj._isAttachedDOMNodeList;
      }
    });

    function makeAttachedDOMNodeList(domNodeList, contentType) {
      const attachedDOMNodeList = [];
      for (let i = 0; i < domNodeList.length; i += 1) {
        attachedDOMNodeList.push(domNodeList[i]);
      }
      attachedDOMNodeList._isAttachedDOMNodeList = true;
      attachedDOMNodeList.ownerDocument = { contentType };
      return attachedDOMNodeList;
    }

    expect.exportType({
      name: 'HTMLDocType',
      base: 'DOMNode',
      identify(obj) {
        return (
          obj &&
          typeof obj.nodeType === 'number' &&
          obj.nodeType === 10 &&
          'publicId' in obj
        );
      },
      inspect(doctype, depth, output, inspect) {
        return output.code(`<!DOCTYPE ${doctype.name}>`, 'html');
      },
      equal(a, b) {
        return a.toString() === b.toString();
      },
      diff(actual, expected, output, diff) {
        const d = diff(
          `<!DOCTYPE ${actual.name}>`,
          `<!DOCTYPE ${expected.name}>`
        );
        d.inline = true;
        return d;
      }
    });

    expect.exportType({
      name: 'DOMDocument',
      base: 'DOMNode',
      identify(obj) {
        return (
          obj &&
          typeof obj.nodeType === 'number' &&
          obj.nodeType === 9 &&
          obj.documentElement &&
          obj.implementation
        );
      },
      inspect(document, depth, output, inspect) {
        for (let i = 0; i < document.childNodes.length; i += 1) {
          output.append(inspect(document.childNodes[i]));
        }
        return output;
      },
      diff(actual, expected, output, diff, inspect, equal) {
        output.inline = true;
        output.append(
          diff(
            makeAttachedDOMNodeList(actual.childNodes),
            makeAttachedDOMNodeList(expected.childNodes)
          )
        );
        return output;
      }
    });

    expect.exportType({
      name: 'HTMLDocument',
      base: 'DOMDocument',
      identify(obj) {
        return this.baseType.identify(obj) && obj.contentType === 'text/html';
      }
    });

    expect.exportType({
      name: 'XMLDocument',
      base: 'DOMDocument',
      identify(obj) {
        return (
          this.baseType.identify(obj) &&
          /^(?:application|text)\/xml|\+xml\b/.test(obj.contentType)
        );
      },
      inspect(document, depth, output, inspect) {
        output.code('<?xml version="1.0"?>', 'xml');
        for (let i = 0; i < document.childNodes.length; i += 1) {
          output.append(inspect(document.childNodes[i], depth - 1));
        }
        return output;
      }
    });

    expect.exportType({
      name: 'DOMDocumentFragment',
      base: 'DOMNode',
      identify(obj) {
        return obj && obj.nodeType === 11; // In jsdom, documentFragment.toString() does not return [object DocumentFragment]
      },
      inspect(documentFragment, depth, output, inspect) {
        return output
          .text('DocumentFragment[')
          .append(inspect(documentFragment.childNodes, depth))
          .text(']');
      },
      diff(actual, expected, output, diff, inspect, equal) {
        output.inline = true;
        output.block(
          diff(
            makeAttachedDOMNodeList(actual.childNodes),
            makeAttachedDOMNodeList(expected.childNodes)
          )
        );
        return output;
      }
    });

    expect.exportType({
      name: 'DOMElement',
      base: 'DOMNode',
      identify(obj) {
        return (
          obj &&
          typeof obj.nodeType === 'number' &&
          obj.nodeType === 1 &&
          obj.nodeName &&
          obj.attributes
        );
      },
      equal(a, b, equal) {
        const aIsHtml = isInsideHtmlDocument(a);
        const bIsHtml = isInsideHtmlDocument(b);
        return (
          aIsHtml === bIsHtml &&
          (aIsHtml
            ? a.nodeName.toLowerCase() === b.nodeName.toLowerCase()
            : a.nodeName === b.nodeName) &&
          equal(getAttributes(a), getAttributes(b)) &&
          equal(a.childNodes, b.childNodes)
        );
      },
      inspect(element, depth, output, inspect) {
        const elementName = element.nodeName.toLowerCase();
        const startTag = stringifyStartTag(element);

        output.code(startTag, 'html');
        if (element.childNodes.length > 0) {
          if (depth === 1) {
            output.text('...');
          } else {
            const inspectedChildren = [];
            if (elementName === 'script') {
              let type = element.getAttribute('type');
              if (!type || /javascript/.test(type)) {
                type = 'javascript';
              }
              inspectedChildren.push(
                output.clone().code(element.textContent, type)
              );
            } else if (elementName === 'style') {
              inspectedChildren.push(
                output
                  .clone()
                  .code(
                    element.textContent,
                    element.getAttribute('type') || 'text/css'
                  )
              );
            } else {
              for (let i = 0; i < element.childNodes.length; i += 1) {
                inspectedChildren.push(inspect(element.childNodes[i]));
              }
            }

            let width = startTag.length;
            const multipleLines = inspectedChildren.some(o => {
              const size = o.size();
              width += size.width;
              return width > 60 || o.height > 1;
            });

            if (multipleLines) {
              output.nl().indentLines();

              inspectedChildren.forEach((inspectedChild, index) => {
                output
                  .i()
                  .block(inspectedChild)
                  .nl();
              });

              output.outdentLines();
            } else {
              inspectedChildren.forEach((inspectedChild, index) =>
                output.append(inspectedChild)
              );
            }
          }
        }
        output.code(stringifyEndTag(element), 'html');
        return output;
      },
      diffLimit: 512,
      diff(actual, expected, output, diff, inspect, equal) {
        const isHtml = isInsideHtmlDocument(actual);
        output.inline = true;

        if (Math.max(actual.length, expected.length) > this.diffLimit) {
          output.jsComment(`Diff suppressed due to size > ${this.diffLimit}`);
          return output;
        }

        const emptyElements =
          actual.childNodes.length === 0 && expected.childNodes.length === 0;
        const conflictingElement =
          actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase() ||
          !equal(getAttributes(actual), getAttributes(expected));

        if (conflictingElement) {
          let canContinueLine = true;
          output.prismPunctuation('<').prismTag(actual.nodeName.toLowerCase());
          if (
            actual.nodeName.toLowerCase() !== expected.nodeName.toLowerCase()
          ) {
            output
              .sp()
              .annotationBlock(output =>
                output
                  .error('should be')
                  .sp()
                  .prismTag(expected.nodeName.toLowerCase())
              )
              .nl();
            canContinueLine = false;
          }
          const actualAttributes = getAttributes(actual);
          const expectedAttributes = getAttributes(expected);
          Object.keys(actualAttributes).forEach(attributeName => {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            writeAttributeToMagicPen(
              output,
              attributeName,
              actualAttributes[attributeName],
              isHtml
            );
            if (attributeName in expectedAttributes) {
              if (
                actualAttributes[attributeName] ===
                expectedAttributes[attributeName]
              ) {
                canContinueLine = true;
              } else {
                output
                  .sp()
                  .annotationBlock(output =>
                    output
                      .error('should equal')
                      .sp()
                      .append(
                        inspect(entitify(expectedAttributes[attributeName]))
                      )
                  )
                  .nl();
                canContinueLine = false;
              }
              delete expectedAttributes[attributeName];
            } else {
              output
                .sp()
                .annotationBlock(output => output.error('should be removed'))
                .nl();
              canContinueLine = false;
            }
          });
          Object.keys(expectedAttributes).forEach(attributeName => {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            output
              .annotationBlock(output => {
                output.error('missing').sp();
                writeAttributeToMagicPen(
                  output,
                  attributeName,
                  expectedAttributes[attributeName],
                  isHtml
                );
              })
              .nl();
            canContinueLine = false;
          });
          output.prismPunctuation('>');
        } else {
          output.code(stringifyStartTag(actual), 'html');
        }

        if (!emptyElements) {
          output
            .nl()
            .indentLines()
            .i()
            .block(
              diff(
                makeAttachedDOMNodeList(actual.childNodes),
                makeAttachedDOMNodeList(expected.childNodes)
              )
            )
            .nl()
            .outdentLines();
        }

        output.code(stringifyEndTag(actual), 'html');
        return output;
      }
    });

    expect.exportAssertion(
      '<DOMElement> to have (class|classes) <array|string>',
      (expect, subject, value) =>
        expect(subject, 'to have attributes', { class: value })
    );

    expect.exportAssertion(
      '<DOMElement> to only have (class|classes) <array|string>',
      (expect, subject, value) =>
        expect(subject, 'to have attributes', {
          class: className => {
            const actualClasses = getClassNamesFromAttributeValue(className);
            if (typeof value === 'string') {
              value = getClassNamesFromAttributeValue(value);
            }
            return bubbleError(() =>
              expect(actualClasses.sort(), 'to equal', value.sort())
            );
          }
        })
    );

    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <DOMTextNode>',
      (expect, subject, value) =>
        expect(subject.nodeValue, 'to equal', value.nodeValue)
    );

    expect.exportAssertion(
      '<DOMComment> to [exhaustively] satisfy <DOMComment>',
      (expect, subject, value) =>
        expect(subject.nodeValue, 'to equal', value.nodeValue)
    );

    // Avoid rendering a huge object diff when a text node is matched against a different node type:
    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <object>',
      (expect, subject, value) => expect.fail()
    );

    // Always passes:
    expect.exportAssertion(
      // Name each subject type to increase the specificity of the assertion
      '<DOMComment|DOMElement|DOMTextNode|DOMDocument|HTMLDocType> to [exhaustively] satisfy <DOMIgnoreComment>',
      (expect, subject, value) => {}
    );

    // Necessary because this case would otherwise be handled by the above catch-all for <object>:
    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <regexp>',
      (expect, { nodeValue }, value) => expect(nodeValue, 'to satisfy', value)
    );

    expect.exportAssertion(
      '<DOMTextNode> to [exhaustively] satisfy <any>',
      (expect, { nodeValue }, value) => expect(nodeValue, 'to satisfy', value)
    );

    function convertDOMNodeToSatisfySpec(node, isHtml) {
      if (node.nodeType === 10) {
        // HTMLDocType
        return { name: node.nodeName };
      } else if (node.nodeType === 1) {
        // DOMElement
        const name = isHtml ? node.nodeName.toLowerCase() : node.nodeName;

        const result = { name };

        if (node.attributes) {
          result.attributes = {};
          for (let i = 0; i < node.attributes.length; i += 1) {
            result.attributes[node.attributes[i].name] =
              isHtml && isBooleanAttribute(node.attributes[i].name)
                ? true
                : node.attributes[i].value || '';
          }
        }
        result.children = Array.prototype.map.call(node.childNodes, childNode =>
          convertDOMNodeToSatisfySpec(childNode, isHtml)
        );
        return result;
      } else if (node.nodeType === 3) {
        // DOMTextNode
        return node.nodeValue;
      } else if (node.nodeType === 8) {
        // DOMComment
        return node;
      } else {
        throw new Error(
          `to satisfy: Node type ${
            node.nodeType
          } is not yet supported in the value`
        );
      }
    }

    expect.exportAssertion(
      '<DOMNodeList> to [exhaustively] satisfy <string>',
      (expect, subject, value) => {
        const isHtml = subject.ownerDocument.contentType === 'text/html';

        expect.argsOutput = output =>
          output.code(value, isHtml ? 'html' : 'xml');

        return expect(
          subject,
          'to [exhaustively] satisfy',
          (isHtml ? parseHtml(value, true) : parseXml(value)).childNodes
        );
      }
    );

    expect.exportAssertion(
      '<DOMNodeList> to [exhaustively] satisfy <DOMNodeList>',
      (expect, subject, value) => {
        const isHtml = subject.ownerDocument.contentType === 'text/html';
        const satisfySpecs = [];
        for (let i = 0; i < value.length; i += 1) {
          satisfySpecs.push(convertDOMNodeToSatisfySpec(value[i], isHtml));
        }
        return expect(subject, 'to [exhaustively] satisfy', satisfySpecs);
      }
    );

    expect.exportAssertion(
      '<DOMDocumentFragment> to [exhaustively] satisfy <string>',
      (expect, subject, value) => {
        const isHtml = isInsideHtmlDocument(subject);

        expect.argsOutput = output =>
          output.code(value, isHtml ? 'html' : 'xml');

        return expect(
          subject,
          'to [exhaustively] satisfy',
          isHtml ? parseHtml(value, true) : parseXml(value)
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocumentFragment> to [exhaustively] satisfy <DOMDocumentFragment>',
      (expect, subject, { childNodes }) => {
        const isHtml = subject.ownerDocument.contentType === 'text/html';
        return expect(
          subject,
          'to [exhaustively] satisfy',
          Array.prototype.map.call(childNodes, childNode =>
            convertDOMNodeToSatisfySpec(childNode, isHtml)
          )
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocumentFragment> to [exhaustively] satisfy <object|array>',
      (expect, { childNodes }, value) =>
        expect(childNodes, 'to [exhaustively] satisfy', value)
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <string>',
      (expect, subject, value) => {
        const isHtml = isInsideHtmlDocument(subject);
        const documentFragment = isHtml
          ? parseHtml(value, true)
          : parseXml(value);
        if (documentFragment.childNodes.length !== 1) {
          throw new Error(
            'HTMLElement to satisfy string: Only a single node is supported'
          );
        }

        expect.argsOutput = output =>
          output.code(value, isHtml ? 'html' : 'xml');

        return expect(
          subject,
          'to [exhaustively] satisfy',
          documentFragment.childNodes[0]
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocument> to [exhaustively] satisfy <string>',
      (expect, subject, value) => {
        const isHtml = isInsideHtmlDocument(subject);
        const valueDocument = isHtml
          ? parseHtml(value, false)
          : parseXml(value);
        return expect(
          makeAttachedDOMNodeList(subject.childNodes),
          'to [exhaustively] satisfy',
          Array.prototype.map.call(valueDocument.childNodes, childNode =>
            convertDOMNodeToSatisfySpec(childNode, isHtml)
          )
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocument> to [exhaustively] satisfy <DOMDocument>',
      (expect, subject, { childNodes }) => {
        const isHtml = isInsideHtmlDocument(subject);
        return expect(
          makeAttachedDOMNodeList(subject.childNodes),
          'to [exhaustively] satisfy',
          Array.prototype.map.call(childNodes, childNode =>
            convertDOMNodeToSatisfySpec(childNode, isHtml)
          )
        );
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <DOMElement>',
      (expect, subject, value) =>
        expect(
          subject,
          'to [exhaustively] satisfy',
          convertDOMNodeToSatisfySpec(value, isInsideHtmlDocument(subject))
        )
    );

    expect.exportAssertion(
      [
        '<DOMElement> to [exhaustively] satisfy <DOMTextNode>',
        '<DOMTextNode> to [exhaustively] satisfy <DOMElement>',
        '<DOMElement|DOMDocumentFragment|DOMDocument> to [exhaustively] satisfy <regexp>'
      ],
      (expect, subject, value) => expect.fail()
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <object>',
      (expect, subject, value) => {
        const isHtml = isInsideHtmlDocument(subject);
        const unsupportedOptions = Object.keys(value).filter(
          key =>
            key !== 'attributes' &&
            key !== 'name' &&
            key !== 'children' &&
            key !== 'onlyAttributes' &&
            key !== 'textContent'
        );
        if (unsupportedOptions.length > 0) {
          throw new Error(
            `Unsupported option${
              unsupportedOptions.length === 1 ? '' : 's'
            }: ${unsupportedOptions.join(', ')}`
          );
        }

        const promiseByKey = {
          name: expect.promise(() => {
            if (value && typeof value.name !== 'undefined') {
              return bubbleError(() =>
                expect(
                  isHtml ? subject.nodeName.toLowerCase() : subject.nodeName,
                  'to satisfy',
                  value.name
                )
              );
            }
          }),
          children: expect.promise(() => {
            if (typeof value.children !== 'undefined') {
              if (typeof value.textContent !== 'undefined') {
                throw new Error(
                  'The children and textContent properties are not supported together'
                );
              }
              return bubbleError(() =>
                expect(
                  makeAttachedDOMNodeList(
                    subject.childNodes,
                    subject.ownerDocument.contentType
                  ),
                  'to satisfy',
                  value.children
                )
              );
            } else if (typeof value.textContent !== 'undefined') {
              return bubbleError(() =>
                expect(subject.textContent, 'to satisfy', value.textContent)
              );
            }
          }),
          attributes: {}
        };

        const onlyAttributes =
          (value && value.onlyAttributes) || expect.flags.exhaustively;
        const attrs = getAttributes(subject);
        let expectedAttributes = value && value.attributes;
        const expectedAttributeNames = [];
        let expectedValueByAttributeName = {};

        if (typeof expectedAttributes !== 'undefined') {
          if (typeof expectedAttributes === 'string') {
            expectedAttributes = [expectedAttributes];
          }
          if (Array.isArray(expectedAttributes)) {
            expectedAttributes.forEach(attributeName => {
              expectedValueByAttributeName[attributeName] = true;
            });
          } else if (
            expectedAttributes &&
            typeof expectedAttributes === 'object'
          ) {
            expectedValueByAttributeName = expectedAttributes;
          }
          Object.keys(expectedValueByAttributeName).forEach(attributeName => {
            expectedAttributeNames.push(attributeName);
          });

          expectedAttributeNames.forEach(attributeName => {
            const attributeValue = subject.getAttribute(attributeName);
            const expectedAttributeValue =
              expectedValueByAttributeName[attributeName];
            promiseByKey.attributes[attributeName] = expect.promise(() => {
              if (typeof expectedAttributeValue === 'undefined') {
                return bubbleError(() =>
                  expect(subject.hasAttribute(attributeName), 'to be false')
                );
              } else if (isEnumeratedAttribute(attributeName)) {
                const indexOfEnumeratedAttributeValue = enumeratedAttributeValues[
                  attributeName
                ].indexOf(expectedAttributeValue);

                return bubbleError(() => {
                  if (indexOfEnumeratedAttributeValue === -1) {
                    expect.fail(output =>
                      output
                        .text('Invalid expected value ')
                        .appendInspected(expectedAttributeValue)
                        .text('. Supported values include: ')
                        .appendItems(
                          enumeratedAttributeValues[attributeName],
                          ', '
                        )
                    );
                  }

                  expect(attributeValue, 'to satisfy', expectedAttributeValue);
                });
              } else if (expectedAttributeValue === true) {
                return bubbleError(() =>
                  expect(subject.hasAttribute(attributeName), 'to be true')
                );
              } else if (
                attributeName === 'class' &&
                (typeof expectedAttributeValue === 'string' ||
                  Array.isArray(expectedAttributeValue))
              ) {
                const actualClasses = getClassNamesFromAttributeValue(
                  attributeValue
                );
                let expectedClasses = expectedAttributeValue;
                if (typeof expectedClasses === 'string') {
                  expectedClasses = getClassNamesFromAttributeValue(
                    expectedAttributeValue
                  );
                }
                if (onlyAttributes) {
                  return bubbleError(() =>
                    expect(
                      actualClasses.sort(),
                      'to equal',
                      expectedClasses.sort()
                    )
                  );
                } else {
                  if (expectedClasses.length === 0) {
                    return bubbleError(() =>
                      expect(expectedClasses, 'to be empty')
                    );
                  }
                  return bubbleError(() =>
                    expect(actualClasses, 'to contain', ...expectedClasses)
                  );
                }
              } else if (attributeName === 'style') {
                let expectedStyleObj;
                if (typeof expectedValueByAttributeName.style === 'string') {
                  validateStyles(expect, expectedValueByAttributeName.style);
                  expectedStyleObj = styleStringToObject(
                    expectedValueByAttributeName.style
                  );
                } else {
                  expectedStyleObj = expectedValueByAttributeName.style;
                }

                if (onlyAttributes) {
                  return bubbleError(() =>
                    expect(
                      attrs.style,
                      'to exhaustively satisfy',
                      expectedStyleObj
                    )
                  );
                } else {
                  return bubbleError(() =>
                    expect(attrs.style, 'to satisfy', expectedStyleObj)
                  );
                }
              } else {
                return bubbleError(() =>
                  expect(attributeValue, 'to satisfy', expectedAttributeValue)
                );
              }
            });
          });

          promiseByKey.attributePresence = expect.promise(() => {
            const attributeNamesExpectedToBeDefined = [];
            expectedAttributeNames.forEach(attributeName => {
              if (
                typeof expectedValueByAttributeName[attributeName] ===
                'undefined'
              ) {
                expect(attrs, 'not to have key', attributeName);
              } else {
                attributeNamesExpectedToBeDefined.push(attributeName);
                expect(attrs, 'to have key', attributeName);
              }
            });
            if (onlyAttributes) {
              expect(
                Object.keys(attrs).sort(),
                'to equal',
                attributeNamesExpectedToBeDefined.sort()
              );
            }
          });
        }

        return expect.promise.all(promiseByKey).caught(() =>
          expect.promise.settle(promiseByKey).then(() => {
            expect.fail({
              diff(output, diff, inspect, equal) {
                output.block(output => {
                  let seenError = false;
                  output
                    .prismPunctuation('<')
                    .prismTag(
                      isHtml ? subject.nodeName.toLowerCase() : subject.nodeName
                    );
                  if (promiseByKey.name.isRejected()) {
                    seenError = true;
                    const nameError = promiseByKey.name.reason();
                    output.sp().annotationBlock(output =>
                      output
                        .error(
                          (nameError && nameError.getLabel()) ||
                            'should satisfy'
                        )
                        .sp()
                        .append(inspect(value.name))
                    );
                  }
                  const inspectedAttributes = [];
                  Object.keys(attrs).forEach(attributeName => {
                    const attributeOutput = output.clone();
                    const promise = promiseByKey.attributes[attributeName];
                    writeAttributeToMagicPen(
                      attributeOutput,
                      attributeName,
                      attrs[attributeName],
                      isHtml
                    );
                    if (
                      (promise && promise.isFulfilled()) ||
                      (!promise &&
                        (!onlyAttributes ||
                          expectedAttributeNames.indexOf(attributeName) !== -1))
                    ) {
                    } else {
                      seenError = true;
                      attributeOutput.sp().annotationBlock(output => {
                        if (
                          promise &&
                          typeof expectedValueByAttributeName[attributeName] !==
                            'undefined'
                        ) {
                          output.appendErrorMessage(promise.reason());
                        } else {
                          // onlyAttributes === true
                          output.error('should be removed');
                        }
                      });
                    }
                    inspectedAttributes.push(attributeOutput);
                  });
                  expectedAttributeNames.forEach(attributeName => {
                    if (!subject.hasAttribute(attributeName)) {
                      const promise = promiseByKey.attributes[attributeName];
                      if (!promise || promise.isRejected()) {
                        seenError = true;
                        const err = promise && promise.reason();
                        const attributeOutput = output
                          .clone()
                          .annotationBlock(output => {
                            output
                              .error('missing')
                              .sp()
                              .prismAttrName(attributeName, 'html');
                            if (
                              expectedValueByAttributeName[attributeName] !==
                              true
                            ) {
                              output
                                .sp()
                                .error(
                                  (err && err.getLabel()) || 'should satisfy'
                                )
                                .sp()
                                .append(
                                  inspect(
                                    expectedValueByAttributeName[attributeName]
                                  )
                                );
                            }
                          });
                        inspectedAttributes.push(attributeOutput);
                      }
                    }
                  });
                  if (inspectedAttributes.length > 0) {
                    if (seenError) {
                      output
                        .nl()
                        .indentLines()
                        .indent()
                        .block(output => {
                          inspectedAttributes.forEach((item, i) => {
                            if (i > 0) {
                              output.nl();
                            }
                            output.append(item);
                          });
                        })
                        .outdentLines()
                        .nl();
                    } else {
                      output.sp();
                      inspectedAttributes.forEach((item, i) => {
                        if (i > 0) {
                          output.sp();
                        }
                        output.append(item);
                      });
                    }
                  } else if (seenError) {
                    // The tag name mismatched
                    output.nl();
                  }

                  output.prismPunctuation('>');
                  const childrenError =
                    promiseByKey.children.isRejected() &&
                    promiseByKey.children.reason();
                  if (childrenError) {
                    const childrenDiff = childrenError.getDiff(output);
                    if (childrenDiff && childrenDiff.inline) {
                      output
                        .nl()
                        .indentLines()
                        .i()
                        .block(childrenDiff)
                        .nl()
                        .outdentLines();
                    } else {
                      output
                        .nl()
                        .indentLines()
                        .i()
                        .block(output => {
                          for (
                            let i = 0;
                            i < subject.childNodes.length;
                            i += 1
                          ) {
                            output.append(inspect(subject.childNodes[i])).nl();
                          }
                        });
                      output
                        .sp()
                        .annotationBlock(output =>
                          output.appendErrorMessage(childrenError)
                        );
                      output.nl();
                    }
                  } else {
                    for (let i = 0; i < subject.childNodes.length; i += 1) {
                      output.append(inspect(subject.childNodes[i]));
                    }
                  }
                  output.code(stringifyEndTag(subject), 'html');
                });
                output.inline = true;
                return output;
              }
            });
          })
        );
      }
    );

    expect.exportAssertion(
      '<DOMElement> to [only] have (attribute|attributes) <string+>',
      (expect, subject, ...args) =>
        expect(subject, 'to [only] have attributes', args)
    );

    expect.exportAssertion(
      '<DOMElement> not to have (attribute|attributes) <array>',
      (expect, subject, value) => {
        const attributes = getAttributes(subject);

        value.forEach(name => {
          delete attributes[name];
        });

        return expect(subject, 'to only have attributes', attributes);
      }
    );

    expect.exportAssertion(
      '<DOMElement> not to have (attribute|attributes) <string+>',
      (expect, subject, ...args) =>
        expect(subject, 'not to have attributes', args)
    );

    expect.exportAssertion(
      '<DOMElement> to [only] have (attribute|attributes) <array|object>',
      (expect, subject, value) =>
        expect(subject, 'to satisfy', {
          attributes: value,
          onlyAttributes: expect.flags.only
        })
    );

    expect.exportAssertion(
      '<DOMElement> to have [no] (child|children)',
      (expect, { childNodes }) =>
        expect.flags.no
          ? expect(childNodes, 'to be empty')
          : expect(childNodes, 'not to be empty')
    );

    expect.exportAssertion(
      '<DOMElement> to have text <any>',
      (expect, { textContent }, value) =>
        expect(textContent, 'to satisfy', value)
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [when] queried for [first] <string> <assertion?>',
      (expect, subject, query) => {
        let queryResult;

        expect.argsOutput[0] = output => output.green(query);
        expect.errorMode = 'nested';

        if (expect.flags.first) {
          queryResult = subject.querySelector(query);
          if (!queryResult) {
            expect.subjectOutput = output =>
              expect.inspect(subject, Infinity, output);

            expect.fail(output =>
              output
                .error('The selector')
                .sp()
                .jsString(query)
                .sp()
                .error('yielded no results')
            );
          }
        } else {
          queryResult = subject.querySelectorAll(query);
          if (queryResult.length === 0) {
            expect.subjectOutput = output =>
              expect.inspect(subject, Infinity, output);

            expect.fail(output =>
              output
                .error('The selector')
                .sp()
                .jsString(query)
                .sp()
                .error('yielded no results')
            );
          }
        }
        return expect.shift(queryResult);
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> to contain [no] elements matching <string>',
      (expect, subject, query) => {
        if (expect.flags.no) {
          return expect(subject.querySelectorAll(query), 'to satisfy', []);
        }

        expect.subjectOutput = output =>
          expect.inspect(subject, Infinity, output);

        return expect(subject.querySelectorAll(query), 'not to satisfy', []);
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to match <string>',
      (expect, subject, query) => {
        expect.subjectOutput = output =>
          expect.inspect(subject, Infinity, output);

        return expect(matchesSelector(subject, query), '[not] to be true');
      }
    );

    expect.exportAssertion(
      '<string> [when] parsed as (html|HTML) [fragment] <assertion?>',
      (expect, subject) => {
        expect.errorMode = 'nested';
        return expect.shift(parseHtml(subject, expect.flags.fragment));
      }
    );

    expect.exportAssertion(
      '<string> [when] parsed as (xml|XML) <assertion?>',
      (expect, subject) => {
        expect.errorMode = 'nested';
        return expect.shift(parseXml(subject));
      }
    );
  }
};
