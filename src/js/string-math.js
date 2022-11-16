const StringMath = (expr, scope) => {
  const numReg = /^(-|)[0-9\.]{1,}/;
  const varReg = /^((\.|)([a-zA-Z][a-zA-Z0-9\.]*))/;
  const multi = (n1, n2) => n1 * n2;
  const div = (n1, n2) => n1 / n2;
  const add = (n1, n2) => n1 + n2;
  const sub = (n1, n2) => n1 - n2;

  function resolve(path, currObj, globalCheck) {
    if (path === "") return currObj;
    try {
      if (typeof path === "string") path = path.split(".");
      for (let index = 0; index < path.length; index += 1) {
        currObj = currObj[path[index]];
      }
      if (currObj === undefined && !globalCheck) throw Error("try global");
      return currObj;
    } catch (e) {
      return resolve(path, {}, true);
    }
  }

  function multiplyOrDivide(values, operands) {
    const op = operands[operands.length - 1];
    if (op === multi || op === div) {
      const len = values.length;
      values[len - 2] = op(values[len - 2], values[len - 1]);
      values.pop();
      operands.pop();
    }
  }

  const resolveArguments = (initialChar, func) => {
    return function (expr, index, values, operands, scope, path) {
      if (expr[index] === initialChar) {
        const args = [];
        let endIndex = (index += 1);
        const terminationChar = expr[index - 1] === "(" ? ")" : "]";
        let terminate = false;
        let openParenCount = 0;
        while (!terminate && endIndex < expr.length) {
          const currChar = expr[endIndex++];
          if (currChar === "(") openParenCount++;
          else if (openParenCount > 0 && currChar === ")") openParenCount--;
          else if (openParenCount === 0) {
            if (currChar === ",") {
              args.push(expr.substr(index, endIndex - index - 1));
              index = endIndex;
            } else if (openParenCount === 0 && currChar === terminationChar) {
              args.push(expr.substr(index, endIndex++ - index - 1));
              terminate = true;
            }
          }
        }

        for (let index = 0; index < args.length; index += 1) {
          args[index] = StringMath(args[index], scope);
        }
        const state = func(expr, path, scope, args, endIndex);
        if (state) {
          values.push(state.value);
          return state.endIndex;
        }
      }
    };
  };

  function chainedExpressions(expr, value, endIndex, path) {
    if (expr.length === endIndex) return { value, endIndex };
    let values = [];
    let offsetIndex;
    let valueIndex = 0;
    let chained = false;
    do {
      const subStr = expr.substr(endIndex);
      const offsetIndex =
        isolateArray(subStr, 0, values, [], value, path) ||
        isolateFunction(subStr, 0, values, [], value, path) ||
        (subStr[0] === "." && isolateVar(subStr, 1, values, [], value));
      if (Number.isInteger(offsetIndex)) {
        value = values[valueIndex];
        endIndex += offsetIndex - 1;
        chained = true;
      }
    } while (offsetIndex !== undefined);
    return { value, endIndex };
  }

  const isolateArray = resolveArguments(
    "[",
    (expr, path, scope, args, endIndex) => {
      endIndex = endIndex - 1;
      let value = resolve(path, scope)[args[args.length - 1]];
      return chainedExpressions(expr, value, endIndex, "");
    }
  );

  const isolateFunction = resolveArguments(
    "(",
    (expr, path, scope, args, endIndex) =>
      chainedExpressions(
        expr,
        resolve(path, scope).apply(null, args),
        endIndex - 1,
        ""
      )
  );

  function isolateParenthesis(expr, index, values, operands, scope) {
    const char = expr[index];
    if (char === "(") {
      let openParenCount = 1;
      let endIndex = index + 1;
      while (openParenCount > 0 && endIndex < expr.length) {
        const currChar = expr[endIndex++];
        if (currChar === "(") openParenCount++;
        if (currChar === ")") openParenCount--;
      }
      const len = endIndex - index - 2;
      values.push(StringMath(expr.substr(index + 1, len), scope));
      multiplyOrDivide(values, operands);
      return endIndex;
    }
  }

  function isolateOperand(char, operands) {
    switch (char) {
      case "*":
        operands.push(multi);
        return true;
        break;
      case "/":
        operands.push(div);
        return true;
        break;
      case "+":
        operands.push(add);
        return true;
        break;
      case "-":
        operands.push(sub);
        return true;
        break;
    }
    return false;
  }

  function isolateValueReg(reg, resolver) {
    return function (expr, index, values, operands, scope) {
      const match = expr.substr(index).match(reg);
      let args;
      if (match) {
        let endIndex = index + match[0].length;
        let value = resolver(match[0], scope);
        if (!Number.isFinite(value)) {
          const state = chainedExpressions(expr, scope, endIndex, match[0]);
          if (state !== undefined) {
            value = state.value;
            endIndex = state.endIndex;
          }
        }
        values.push(value);
        multiplyOrDivide(values, operands);
        return endIndex;
      }
    };
  }

  const isolateNumber = isolateValueReg(numReg, Number.parseFloat);

  const isolateVar = isolateValueReg(varReg, resolve);
  const allowVars = typeof scope === "object";
  let operands = [];
  let values = [];
  let prevWasOpperand = true;

  for (let index = 0; index < expr.length; index += 1) {
    const char = expr[index];
    if (prevWasOpperand) {
      let newIndex =
        isolateParenthesis(expr, index, values, operands, scope) ||
        isolateNumber(expr, index, values, operands, scope) ||
        (allowVars && isolateVar(expr, index, values, operands, scope));
      if (Number.isInteger(newIndex)) {
        index = newIndex - 1;
        prevWasOpperand = false;
      }
    } else {
      prevWasOpperand = isolateOperand(char, operands);
    }
  }
  let value = values[0];
  for (let index = 0; index < values.length - 1; index += 1) {
    value = operands[index](values[index], values[index + 1]);
    values[index + 1] = value;
  }
  return value;
};

export default StringMath;
