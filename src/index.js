/* global DOMParser */
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
  draggable: ['true', 'false'], // defaults to 'auto'
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
    .filter(
      (part) =>
        !/^\s*(\w|-)+\s*:\s*(#(?:[0-9a-fA-F]{3}){1,2}|[^#]+)\s*$|^$/.test(part)
    );

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

  str.split(';').forEach((rule) => {
    const colonIndex = rule.indexOf(':');

    // Guard against empty touples
    if (colonIndex !== -1) {
      const key = rule.slice(0, colonIndex).trim();
      const value = rule.slice(colonIndex + 1).trim();

      styles[key] = value;
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

function getStates(element) {
  const result = {};

  try {
    result.focused = element.ownerDocument.activeElement === element;
  } catch (err) {
    // The document might not be in a window, and thus not able to have an activeElement
  }

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
        .map((cssProp) => `${cssProp}: ${value[cssProp]}`)
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
      .map((cssProp) => [cssProp, value[cssProp]].join(': '))
      .join('; ')}"`;
  } else {
    return `${attributeName}="${entitify(value)}"`;
  }
}

function stringifyStartTag(element) {
  const elementName = isInsideHtmlDocument(element)
    ? element.nodeName.toLowerCase()
    : element.nodeName;
  let str = `<${elementName}`;
  const attrs = getAttributes(element);
  const states = getStates(element);

  Object.keys(attrs).forEach((key) => {
    str += ` ${stringifyAttribute(key, attrs[key])}`;
  });

  if (elementName !== 'body' && states.focused) {
    str += ' :focus';
  }

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

function ensureSupportedSpecOptions(options) {
  const unsupportedOptions = Object.keys(options).filter(
    (key) =>
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
}

module.exports = {
  name: 'unexpected-dom',
  installInto(expect) {
    expect = expect.child();
    expect.use(require('magicpen-prism'));

    function bubbleError(body) {
      return expect.withError(body, (err) => {
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
        return a.nodeType === b.nodeType && a.nodeValue === b.nodeValue;
      },
      diff: () => {},
      inspect(element, depth, output) {
        return output.code(
          `${element.nodeName} "${element.nodeValue}"`,
          'prism-string'
        );
      },
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
      },
    });

    // Recognize <!-- ignore --> as a special subtype of DOMComment so it can be targeted by assertions:
    expect.exportType({
      name: 'DOMIgnoreComment',
      base: 'DOMComment',
      identify(obj) {
        return (
          this.baseType.identify(obj) && /^\s*ignore\s*$/.test(obj.nodeValue)
        );
      },
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
      },
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
      },
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
      },
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
      },
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
      equal(a, b, equal) {
        return equal(a.childNodes, b.childNodes);
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
      },
    });

    expect.exportType({
      name: 'HTMLDocument',
      base: 'DOMDocument',
      identify(obj) {
        return this.baseType.identify(obj) && isInsideHtmlDocument(obj);
      },
    });

    expect.exportType({
      name: 'XMLDocument',
      base: 'DOMDocument',
      identify(obj) {
        return this.baseType.identify(obj) && !isInsideHtmlDocument(obj);
      },
      inspect(document, depth, output, inspect) {
        output.code('<?xml version="1.0"?>', 'xml');
        for (let i = 0; i < document.childNodes.length; i += 1) {
          output.append(inspect(document.childNodes[i], depth - 1));
        }
        return output;
      },
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
      equal(a, b, equal) {
        return equal(a.childNodes, b.childNodes);
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
      },
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
            const sizes = inspectedChildren.map((inspectedChild) =>
              inspectedChild.size()
            );

            const multipleLines = sizes.some((size) => {
              width += size.width;
              return width > 60 || size.height > 1;
            });

            if (multipleLines) {
              output.nl().indentLines();

              inspectedChildren.forEach((inspectedChild, index) => {
                const childSize = sizes[index];
                if (childSize.width > 0 && childSize.height > 0) {
                  output.i().block(inspectedChild);
                }

                output.nl();
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
              .annotationBlock((output) =>
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
          Object.keys(actualAttributes).forEach((attributeName) => {
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
                  .annotationBlock((output) =>
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
                .annotationBlock((output) => output.error('should be removed'))
                .nl();
              canContinueLine = false;
            }
          });
          Object.keys(expectedAttributes).forEach((attributeName) => {
            output.sp(canContinueLine ? 1 : 2 + actual.nodeName.length);
            output
              .annotationBlock((output) => {
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
      },
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
          class: expect.it((className) => {
            const actualClasses = getClassNamesFromAttributeValue(className);
            if (typeof value === 'string') {
              value = getClassNamesFromAttributeValue(value);
            }
            return bubbleError(() =>
              expect(actualClasses.sort(), 'to equal', value.sort())
            );
          }),
        })
    );

    expect.exportAssertion(
      '<DOMElement> not to have (class|classes) <array|string>',
      (expect, subject, value) => {
        return expect(subject, 'to have attributes', {
          class: expect.it((className) => {
            const actualClasses = getClassNamesFromAttributeValue(className);
            let expectedClasses;
            if (typeof value === 'string') {
              expectedClasses = getClassNamesFromAttributeValue(value);
            } else {
              expectedClasses = value;
            }
            return bubbleError(() =>
              expect(actualClasses, 'not to contain', ...expectedClasses)
            );
          }),
        });
      }
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
        result.children = Array.prototype.slice.call(node.childNodes);
        return result;
      } else if (node.nodeType === 3) {
        // DOMTextNode
        return node.nodeValue;
      } else if (node.nodeType === 8) {
        // DOMComment
        return node;
      } else {
        throw new Error(
          `to satisfy: Node type ${node.nodeType} is not yet supported in the value`
        );
      }
    }

    expect.exportAssertion(
      '<DOMNodeList> to [exhaustively] satisfy <string>',
      (expect, subject, value) => {
        const isHtml = isInsideHtmlDocument(subject);

        expect.argsOutput = (output) =>
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
        const isHtml = isInsideHtmlDocument(subject);
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

        expect.argsOutput = (output) =>
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
        const isHtml = isInsideHtmlDocument(subject);
        return expect(
          subject,
          'to [exhaustively] satisfy',
          Array.prototype.map.call(childNodes, (childNode) =>
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

        expect.argsOutput = (output) =>
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
          Array.prototype.map.call(valueDocument.childNodes, (childNode) =>
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
          Array.prototype.map.call(childNodes, (childNode) =>
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
        '<DOMElement> to [exhaustively] satisfy <DOMDocumentFragment>',
        '<DOMElement> to [exhaustively] satisfy <DOMTextNode>',
        '<DOMTextNode> to [exhaustively] satisfy <DOMElement>',
        '<DOMElement|DOMDocumentFragment|DOMDocument> to [exhaustively] satisfy <regexp>',
        '<DOMDocumentFragment|DOMDocument> to [exhaustively] satisfy <DOMElement>',
      ],
      (expect, subject, value) => expect.fail()
    );

    expect.exportAssertion(
      '<DOMElement> to [exhaustively] satisfy <object>',
      (expect, subject, value) => {
        const isHtml = isInsideHtmlDocument(subject);

        if (expect.argTypes[0].is('expect.it')) {
          expect.context.thisObject = subject;
          return value(subject, expect.context);
        }

        ensureSupportedSpecOptions(value);
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

              let contentType = subject.ownerDocument.contentType;
              if (!contentType) {
                // provide a value in the absence of a contentType (IE11)
                contentType = isInsideHtmlDocument(subject)
                  ? 'text/html'
                  : 'application/xml';
              }

              return bubbleError(() =>
                expect(
                  makeAttachedDOMNodeList(subject.childNodes, contentType),
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
          attributes: {},
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
            expectedAttributes.forEach((attributeName) => {
              expectedValueByAttributeName[attributeName] = true;
            });
          } else if (
            expectedAttributes &&
            typeof expectedAttributes === 'object'
          ) {
            expectedValueByAttributeName = expectedAttributes;
          }
          Object.keys(expectedValueByAttributeName).forEach((attributeName) => {
            expectedAttributeNames.push(attributeName);
          });

          expectedAttributeNames.forEach((attributeName) => {
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
                    expect.fail((output) =>
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
              } else if (
                expect.findTypeOf(expectedAttributeValue).is('expect.it')
              ) {
                expect.context.thisObject = subject;
                return bubbleError(() =>
                  expectedAttributeValue(attributeValue, expect.context)
                );
              } else {
                return bubbleError(() =>
                  expect(attributeValue, 'to satisfy', expectedAttributeValue)
                );
              }
            });
          });

          promiseByKey.attributePresence = expect.promise(() => {
            const attributeNamesExpectedToBeDefined = [];
            expectedAttributeNames.forEach((attributeName) => {
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
                output.block((output) => {
                  let seenError = false;
                  output
                    .prismPunctuation('<')
                    .prismTag(
                      isHtml ? subject.nodeName.toLowerCase() : subject.nodeName
                    );
                  if (promiseByKey.name.isRejected()) {
                    seenError = true;
                    const nameError = promiseByKey.name.reason();
                    output.sp().annotationBlock((output) =>
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
                  Object.keys(attrs).forEach((attributeName) => {
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
                      attributeOutput.sp().annotationBlock((output) => {
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
                  expectedAttributeNames.forEach((attributeName) => {
                    if (!subject.hasAttribute(attributeName)) {
                      const promise = promiseByKey.attributes[attributeName];
                      if (!promise || promise.isRejected()) {
                        seenError = true;
                        const err = promise && promise.reason();
                        const attributeOutput = output
                          .clone()
                          .annotationBlock((output) => {
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
                        .block((output) => {
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
                        .block((output) => {
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
                        .annotationBlock((output) =>
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
              },
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

        value.forEach((name) => {
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
          onlyAttributes: expect.flags.only,
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

        expect.argsOutput[0] = (output) => output.green(query);
        expect.errorMode = 'nested';

        if (expect.flags.first) {
          queryResult = subject.querySelector(query);
          if (!queryResult) {
            expect.subjectOutput = (output) =>
              expect.inspect(subject, Infinity, output);

            expect.fail((output) =>
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
            expect.subjectOutput = (output) =>
              expect.inspect(subject, Infinity, output);

            expect.fail((output) =>
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
      '<DOMDocument|DOMElement|DOMDocumentFragment> [when] queried for test id <string> <assertion?>',
      (expect, subject, testId) => {
        expect.errorMode = 'nested';

        const escapedTestId = JSON.stringify(testId);

        return expect(
          subject,
          'queried for first',
          `[data-test-id=${escapedTestId}]`
        ).then((queryResult) => expect.shift(queryResult));
      }
    );

    expect.exportAssertion(
      [
        '<DOMDocument|DOMElement|DOMDocumentFragment> to contain [no] elements matching <string>',
        '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to contain elements matching <string>',
      ],
      (expect, subject, query) => {
        if (expect.flags.no || expect.flags.not) {
          return expect(subject.querySelectorAll(query), 'to satisfy', []);
        }

        expect.subjectOutput = (output) =>
          expect.inspect(subject, Infinity, output);

        return expect(subject.querySelectorAll(query), 'not to satisfy', []);
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to contain test id <string>',
      (expect, subject, testId) => {
        expect.errorMode = 'nested';

        const escapedTestId = JSON.stringify(testId);

        return expect(
          subject,
          '[not] to contain elements matching',
          `[data-test-id=${escapedTestId}]`
        );
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to match <string>',
      (expect, subject, query) => {
        expect.subjectOutput = (output) =>
          expect.inspect(subject, Infinity, output);

        return expect(matchesSelector(subject, query), '[not] to be true');
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment> [not] to have test id <string>',
      (expect, subject, testId) => {
        expect.errorMode = 'nested';
        expect.subjectOutput = (output) =>
          expect.inspect(subject, Infinity, output);

        const escapedTestId = JSON.stringify(testId);

        return expect(
          subject,
          '[not] to match',
          `[data-test-id=${escapedTestId}]`
        );
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

    function memoize(fn) {
      const map = new Map();
      return (node) => {
        let spec = map.get(node);
        if (typeof spec === 'undefined') {
          spec = fn(node);
          map.set(node, spec);
        }
        return spec;
      };
    }

    function scoreElementAgainstSpec(
      element,
      spec,
      memoizedConvertDOMNodeToSatisfySpec
    ) {
      const isTextSimilar = (value, valueSpec) => {
        const actual = (value || '').trim().toLowerCase();
        if (typeof valueSpec === 'string') {
          if (actual === valueSpec.trim().toLowerCase()) {
            return true;
          }
        } else if (valueSpec instanceof RegExp) {
          if (valueSpec.test(actual)) {
            return true;
          }
        } else if (typeof valueSpec === 'function') {
          return true;
        }

        return false;
      };

      const isHtml = isInsideHtmlDocument(element);

      let score = 0;

      const nodeName = isHtml
        ? element.nodeName.toLowerCase()
        : element.nodeName;

      if (isTextSimilar(nodeName, spec.name)) {
        score++;
      }

      if (isTextSimilar(element.textContent, spec.textContent)) {
        score++;
      }

      if (typeof element.hasAttribute === 'function') {
        const attributes = spec.attributes || {};
        const className = attributes.class;
        const style = attributes.style;

        if (className && element.hasAttribute('class')) {
          if (typeof className === 'string') {
            const expectedClasses = getClassNamesFromAttributeValue(className);
            const actualClasses = getClassNamesFromAttributeValue(
              element.getAttribute('class')
            );

            expectedClasses.forEach((expectedClass) => {
              if (actualClasses.indexOf(expectedClass) !== -1) {
                score++;
              }
            });
          } else if (isTextSimilar(element.getAttribute('class'), className)) {
            score++;
          }
        }

        if (style && element.hasAttribute('style')) {
          const expectedStyles =
            typeof style === 'string' ? styleStringToObject(style) : style;
          const actualStyles = styleStringToObject(
            element.getAttribute('style')
          );

          Object.keys(expectedStyles).forEach((styleName) => {
            const expectedStyle = expectedStyles[styleName];
            const actualStyle = actualStyles[styleName];

            if (actualStyle) {
              score++;
            }

            if (isTextSimilar(actualStyle, expectedStyle)) {
              score++;
            }
          });
        }

        const specialAttributes = ['style', 'class'];
        const ids = ['id', 'data-test-id', 'data-testid'];

        Object.keys(attributes).forEach((attributeName) => {
          if (specialAttributes.indexOf(attributeName) !== -1) {
            return; // skip
          }

          if (element.hasAttribute(attributeName)) {
            if (typeof attributes[attributeName] === 'boolean') {
              score++;
            }

            if (
              element.getAttribute(attributeName) === attributes[attributeName]
            ) {
              score += ids.indexOf(attributeName) === -1 ? 1 : 100;
            }
          } else if (typeof attributes[attributeName] === 'undefined') {
            score++;
          }
        });
      }

      const expectedChildren = spec.children || [];

      expectedChildren.forEach((childSpec, i) => {
        const child = element.childNodes[i];
        const childType = expect.findTypeOf(child);
        if (expect.findTypeOf(childSpec).is('DOMNode')) {
          childSpec = memoizedConvertDOMNodeToSatisfySpec(childSpec);
        }

        if (!child) {
          return;
        }

        if (typeof childSpec.nodeType === 'number') {
          if (child.nodeType === childSpec.nodeType) {
            if (childType.is('DOMElement')) {
              // Element
              score += scoreElementAgainstSpec(
                element.childNodes[i],
                memoizedConvertDOMNodeToSatisfySpec(childSpec),
                memoizedConvertDOMNodeToSatisfySpec
              );
            }

            score++;
          } else if (expect.findTypeOf(childSpec).is('DOMIgnoreComment')) {
            score++;
          }
        } else if (
          childType.is('DOMElement') &&
          typeof childSpec === 'object'
        ) {
          score += scoreElementAgainstSpec(
            element.childNodes[i],
            childSpec,
            memoizedConvertDOMNodeToSatisfySpec
          );
        } else if (
          childType.is('DOMTextNode') &&
          isTextSimilar(child.nodeValue, childSpec)
        ) {
          score++;
        }
      });

      return score;
    }

    function findMatchesWithGoodScore(
      data,
      spec,
      memoizedConvertDOMNodeToSatisfySpec
    ) {
      memoizedConvertDOMNodeToSatisfySpec =
        memoizedConvertDOMNodeToSatisfySpec ||
        memoize(convertDOMNodeToSatisfySpec);
      const elements =
        typeof data.length === 'number'
          ? Array.prototype.slice.call(data)
          : [data];

      const result = [];
      let bestScore = 0;

      elements.forEach((element) => {
        const score = scoreElementAgainstSpec(
          element,
          spec,
          memoizedConvertDOMNodeToSatisfySpec
        );
        bestScore = Math.max(score, bestScore);

        if (score > 0 && score >= bestScore) {
          result.push({ score, element });
        }

        for (var i = 0; i < element.childNodes.length; i += 1) {
          const child = element.childNodes[i];
          if (child.nodeType === 1) {
            result.push(
              ...findMatchesWithGoodScore(
                child,
                spec,
                memoizedConvertDOMNodeToSatisfySpec
              )
            );
          }
        }
      });

      result.sort((a, b) => b.score - a.score);

      if (result.length > 0) {
        const bestScore = result[0].score;

        return result.filter(({ score }) => score === bestScore);
      }

      return result;
    }

    expect.exportAssertion(
      '<DOMDocument|DOMElement|DOMDocumentFragment|DOMNodeList> [not] to contain <DOMElement|object|string>',
      (expect, subject, value) => {
        const nodes = subject.childNodes || makeAttachedDOMNodeList(subject);
        const isHtml = isInsideHtmlDocument(
          subject.childNodes ? subject : nodes
        );
        const valueType = expect.findTypeOf(value);
        let spec = value;

        if (valueType.is('expect.it')) {
          throw new Error(
            'Unsupported value for "to contain" assertion: expect.it'
          );
        } else if (valueType.is('DOMElement')) {
          spec = convertDOMNodeToSatisfySpec(value, isHtml);
        } else if (valueType.is('string')) {
          const documentFragment = isHtml
            ? parseHtml(value, true)
            : parseXml(value);

          if (documentFragment.childNodes.length !== 1) {
            throw new Error(
              'HTMLElement to contain string: Only a single node is supported'
            );
          }

          spec = convertDOMNodeToSatisfySpec(
            documentFragment.childNodes[0],
            isHtml
          );

          if (typeof spec === 'string') {
            throw new Error(
              'HTMLElement to contain string: please provide a HTML structure as a string'
            );
          }

          expect.argsOutput = (output) =>
            output.appendInspected(documentFragment.childNodes[0]);

          ensureSupportedSpecOptions(spec);
        }

        const scoredElements = findMatchesWithGoodScore(nodes, spec);

        if (expect.flags.not) {
          if (scoredElements.length > 0) {
            return expect.withError(
              () =>
                expect(
                  scoredElements.map(({ element }) => element),
                  'not to have an item satisfying',
                  spec
                ),
              () => {
                const bestMatch = scoredElements[0].element;

                expect.subjectOutput = (output) =>
                  expect.inspect(subject, Infinity, output);

                expect.fail({
                  diff: (output, diff, inspect, equal) => {
                    return output
                      .error('Found:')
                      .nl(2)
                      .appendInspected(bestMatch);
                  },
                });
              }
            );
          }
        } else {
          if (scoredElements.length === 0) {
            expect.subjectOutput = (output) =>
              expect.inspect(subject, Infinity, output);
            expect.fail();
          }

          return expect.withError(
            () =>
              expect(
                scoredElements.map(({ element }) => element),
                'to have an item satisfying',
                spec
              ),
            () => {
              const bestMatch = scoredElements[0].element;

              return expect(bestMatch, 'to satisfy', spec);
            }
          );
        }
      }
    );

    expect.exportAssertion(
      '<DOMElement> [not] to have focus',
      (expect, subject) => {
        let hasFocus = false;
        try {
          hasFocus = subject === subject.ownerDocument.activeElement;
        } catch (err) {}
        expect(hasFocus, '[not] to be true');
      }
    );

    expect.exportAssertion(
      '<DOMDocument|DOMElement> to contain focused element matching <string>',
      (expect, subject, selector) => {
        expect(subject, 'to contain elements matching', selector);
        expect.errorMode = 'nested';
        expect(subject.querySelector(selector), 'to have focus');
      }
    );
  },
};
