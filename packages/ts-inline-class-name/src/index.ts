import * as ts from "typescript";

const MODULE_NAME = "inline-class-name";
const FUNCTION_NAME = "className";

interface DynamicValue {
  readonly expr: ts.Expression;
  readonly name: string | ts.Expression;
}

function toTemplateExpression(values: Array<string | ts.Expression>): ts.Expression {
  if (values.length === 0) {
    return ts.createStringLiteral("");
  }

  let i = 0;
  let s = "";
  while (i < values.length) {
    const v = values[i];
    if (typeof v === "string") {
      if (s !== "") {
        s += " ";
      }
      s += v;
      i++;
    } else {
      break;
    }
  }

  if (i === values.length) {
    return ts.createStringLiteral(s);
  }

  s += " ";
  const head = ts.createTemplateHead(s, s);
  const spans = [];

  while (i < values.length) {
    const expr = values[i++];

    s = " ";
    while (i < values.length) {
      const l = values[i];
      if (typeof l === "string") {
        if (s !== " ") {
          s += " ";
        }
        s += l;
        i++;
      } else {
        break;
      }
    }

    if (i < values.length) {
      s += " ";
    } else if (s === " ") {
      s = "";
    }
    spans.push(
      ts.createTemplateSpan(
        expr as ts.Expression,
        i < values.length ? ts.createTemplateMiddle(s, s) : ts.createTemplateTail(s, s),
      ),
    );
  }

  return ts.createTemplateExpression(head, spans);
}

function stateToBitSet(
  typeChecker: ts.TypeChecker,
  index: Map<string | ts.Symbol, number>,
  state: Array<string | ts.Expression>,
): number {
  let result = 0;
  for (let i = 0; i < state.length; i++) {
    const s = state[i];
    let v;
    if (typeof s === "string") {
      v = index.get(s);
    } else {
      const sym = typeChecker.getSymbolAtLocation(s);
      if (sym !== void 0) {
        v = index.get(sym);
      }
    }
    if (v !== void 0) {
      result |= 1 << v;
    }
  }
  return result;
}

function shouldIgnoreState(ignore: number[], state: number) {
  for (let i = 0; i < ignore.length; i++) {
    const v = ignore[i];
    if ((state & v) === v) {
      return true;
    }
  }
  return false;
}

function createConditional(
  values: DynamicValue[],
  i: number,
  prevState: Array<string | ts.Expression>,
  stateIndex: Map<string | ts.Symbol, number>,
  ignoreState: number[],
  typeChecker: ts.TypeChecker,
): ts.Expression {
  let value!: DynamicValue;
  let nextState!: Array<string | ts.Expression>;
  while (i < values.length) {
    value = values[i];
    nextState = prevState.concat([value.name]);
    if (shouldIgnoreState(ignoreState, stateToBitSet(typeChecker, stateIndex, nextState))) {
      i++;
    } else {
      break;
    }
  }
  if (i === values.length) {
    return toTemplateExpression(prevState);
  }
  return ts.createParen(ts.createConditional(
    value.expr,
    ts.createToken(ts.SyntaxKind.QuestionToken),
    createConditional(values, i + 1, nextState, stateIndex, ignoreState, typeChecker),
    ts.createToken(ts.SyntaxKind.ColonToken),
    createConditional(values, i + 1, prevState, stateIndex, ignoreState, typeChecker),
  ));
}

export default function inlineClassNameTransformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
  const typeChecker = program.getTypeChecker();
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile) => {
      let inlineClassNameImportModuleStmt: ts.Statement | undefined;
      sourceFile.statements.forEach((stmt, index) => {
        if (ts.isImportDeclaration(stmt)) {
          if (ts.isStringLiteral(stmt.moduleSpecifier) && stmt.moduleSpecifier.text === MODULE_NAME) {
            inlineClassNameImportModuleStmt = stmt;
          }
        }
      });

      if (inlineClassNameImportModuleStmt === void 0) {
        return sourceFile;
      }

      const inlineClassNames = (node: ts.Node): ts.Node => {
        if (ts.isCallExpression(node)) {
          if (node.expression.getText() === FUNCTION_NAME) {
            const arg1 = node.arguments[0];
            if (ts.isObjectLiteralExpression(arg1)) {
              const stateIndex = new Map<ts.Symbol | string, number>();
              const ignoreState: number[] = [];
              const dynamicValues: DynamicValue[] = [];
              const staticPart: Array<string | ts.Expression> = [];
              arg1.properties.forEach((p) => {
                if (ts.isPropertyAssignment(p)) {
                  const name = p.name;
                  if (ts.isComputedPropertyName(name)) {
                    const sym = typeChecker.getSymbolAtLocation(name.expression);
                    if (sym !== void 0) {
                      stateIndex.set(sym, stateIndex.size);
                    }
                  } else if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
                    stateIndex.set(name.text, stateIndex.size);
                  } else {
                    // invalid
                  }

                  if (p.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    if (ts.isComputedPropertyName(name)) {
                      staticPart.push(name.expression);
                    } else if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
                      staticPart.push(name.text);
                    }
                  } else {
                    dynamicValues.push({
                      expr: p.initializer,
                      name: ts.isComputedPropertyName(name) ? name.expression : name.text,
                    });
                  }
                }
              });
              if (node.arguments.length > 1) {
                const arg2 = node.arguments[1];
                if (ts.isArrayLiteralExpression(arg2)) {
                  arg2.elements.forEach((e) => {
                    if (ts.isArrayLiteralExpression(e)) {
                      let state = 0;
                      e.elements.forEach((s) => {
                        if (ts.isStringLiteral(s)) {
                          const i = stateIndex.get(s.text);
                          if (i !== void 0) {
                            state |= 1 << i;
                          }
                        } else if (ts.isIdentifier(s)) {
                          const sym = typeChecker.getSymbolAtLocation(s);
                          if (sym !== void 0) {
                            const i = stateIndex.get(sym);
                            if (i !== void 0) {
                              state |= 1 << i;
                            }
                          }
                        }
                      });
                      if (state !== 0) {
                        ignoreState.push(state);
                      }
                    }
                  });
                }
              }
              return createConditional(dynamicValues, 0, staticPart, stateIndex, ignoreState, typeChecker);
            }
            return node;
          }
        }

        return ts.visitEachChild(node, inlineClassNames, context);
      };

      const next = ts.visitNode(sourceFile, (node) => ts.visitEachChild(node, inlineClassNames, context));
      return ts.updateSourceFileNode(next, next.statements.filter((v) => v !== inlineClassNameImportModuleStmt));
    };
  };
}
