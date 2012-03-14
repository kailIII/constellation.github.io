/*
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true */
/*global striker:true, exports:true */

// now, aiming at bringing this into esprima.js main line
// http://code.google.com/p/esprima/issues/detail?id=89

(function (exports) {
    'use strict';
    var Precedence,
        Generator,
        base,
        indent;

    Precedence = {
        SequenceExpression: 0,
        AssignmentExpression: 1,
        ConditionalExpression: 2,
        LogicalORExpression: 3,
        LogicalANDExpression: 4,
        LogicalXORExpression: 5,
        BitwiseORExpression: 6,
        BitwiseANDExpression: 7,
        EqualityExpression: 8,
        RelationalExpression: 9,
        BitwiseSHIFTExpression: 10,
        AdditiveExpression: 11,
        MultiplicativeExpression: 12,
        UnaryExpression: 13,
        PostfixExpression: 14,
        CallExpression: 15,
        NewExpression: 16,
        MemberExpression: 17,
        PrimaryExpression: 18
    };

    function binaryPrecedence(op) {
        switch (op) {
        // 11.11 Binary Logical Operators
        case '||':
            return Precedence.LogicalORExpression;

        case '&&':
            return Precedence.LogicalANDExpression;

        // 11.10 Binary Bitwise Operators
        case '^':
            return Precedence.LogicalXORExpression;

        case '|':
            return Precedence.BitwiseORExpression;

        case '&':
            return Precedence.BitwiseANDExpression;

        // 11.9 Equality Operators
        case '==':
        case '!=':
        case '===':
        case '!==':
            return Precedence.EqualityExpression;

        // 11.8 Relational Operators
        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'in':
        case 'instanceof':
            return Precedence.RelationalExpression;

        // 11.7 Bitwise Shift Operators
        case '<<':
        case '>>':
        case '>>>':
            return Precedence.BitwiseSHIFTExpression;

        // 11.6 Additive Operators
        case '+':
        case '-':
            return Precedence.AdditiveExpression;

        // 11.5 Multiplicative Operators
        case '*':
        case '%':
        case '/':
            return Precedence.MultiplicativeExpression;
        }
    }

    function addIndent(stmt) {
        return base + stmt;
    }

    function unicodeEscape(ch) {
        var result = '', i, code;

        code = ch.charCodeAt(0);
        for (i = 0; i < 4; i += 1) {
            result = '0123456789ABCDEF'[code % 16] + result;
            code = (code / 16) | 0;
        }

        return '\\u' + result;
    }

    function escapeString(str) {
        var result = '', i, len, ch;

        for (i = 0, len = str.length; i < len; i += 1) {
            ch = str[i];
            if ('\'\\\b\f\n\r\t'.indexOf(ch) >= 0) {
                result += '\\';
                switch (ch) {
                case '\'':
                    result += '\'';
                    break;
                case '\\':
                    result += '\\';
                    break;
                case '\b':
                    result += 'b';
                    break;
                case '\f':
                    result += 'f';
                    break;
                case '\n':
                    result += 'n';
                    break;
                case '\r':
                    result += 'r';
                    break;
                case '\t':
                    result += 't';
                    break;
                }
            } else if (ch < ' ' || ch.charCodeAt(0) >= 0x80) {
                result += unicodeEscape(ch);
            } else {
                result += ch;
            }
        }

        return '\'' + result + '\'';
    }

    function visit(tree) {
        return Generator[tree.type](tree);
    }

    function visitExpr(expr, prec) {
        return Generator[expr.type](expr, prec || Precedence.SequenceExpression);
    }

    function wrapWithPrecedence(text, current, should) {
        return (current < should) ?  '(' + text + ')' : text;
    }

    function generate(tree, options) {
        if (typeof options !== 'undefined') {
            base = options.base || '';
            indent = options.indent || '    ';
        } else {
            base = '';
            indent = '    ';
        }
        return visit(tree);
    }

    function generateBlockStatement(node) {
        var i,
            len,
            result = '{\n',
            previousBase;

        previousBase = base;
        base += indent;

        for (i = 0, len = node.body.length; i < len; i += 1) {
            result += addIndent(visit(node.body[i]));
            result += '\n';
        }

        base = previousBase;
        return result + addIndent('}');
    }

    function maybeBlock(stmt, suffix) {
        var previousBase, result;

        if (stmt.type === 'BlockStatement') {
            result = ' ' + generateBlockStatement(stmt);
            if (suffix) {
                return result + ' ';
            }
            return result;
        }

        if (stmt.type === 'EmptyStatement') {
            result = ';';
        } else {
            previousBase = base;
            base += indent;
            result = '\n' + addIndent(visit(stmt));
            base = previousBase;
        }

        if (suffix) {
            return result + addIndent('\n');
        }
        return result;
    }

    function generateAssignmentExpression(node, prec) {
        return wrapWithPrecedence(
            visit(node.left) + ' ' + node.operator + ' ' +
                visitExpr(node.right, Precedence.AssignmentExpression),
            Precedence.AssignmentExpression,
            prec
        );
    }

    function generateArrayExpression(node, prec) {
        var result, i, len, previousBase;

        if (!node.elements.length) {
            return '[]';
        }

        result = '[\n';

        previousBase = base;
        base += indent;
        for (i = 0, len = node.elements.length; i < len; i += 1) {
            if (node.elements[i]) {
                result += addIndent(visitExpr(node.elements[i], Precedence.AssignmentExpression));
            } else {
                result += addIndent('');
                if ((i + 1) == len) {
                    result += ',';
                }
            }
            if ((i + 1) < len) {
                result += ',\n';
            }
        }
        base = previousBase;
        return result + '\n' + addIndent(']');
    }

    function generateBinaryExpression(node, prec) {
        var current, result;
           
        current  = binaryPrecedence(node.operator);

        result = visitExpr(node.left, current) +
            ' ' + node.operator + ' ' +
            visitExpr(node.right, current + 1);

        if (node.operator === 'in') {
            // TODO(Yusuke Suzuki): parenthesize only in allowIn = false case
            return '(' + result + ')';
        } else {
            return wrapWithPrecedence(result, current, prec);
        }
    }

    function generateBreakStatement(node) {
        if (node.label) {
            return 'break ' + node.label.name + ';';
        }
        return 'break;';
    }

    function generateCallExpression(node, prec) {
        var result, i, len;

        result = visitExpr(node.callee, Precedence.CallExpression) + '(';
        for (i = 0, len = node['arguments'].length; i < len; i += 1) {
            result += visitExpr(node['arguments'][i],
                                Precedence.AssignmentExpression);
            if ((i + 1) < len) {
                result += ', ';
            }
        }
        result += ')';

        return wrapWithPrecedence(result, Precedence.CallExpression, prec);
    }

    function generateCatchClause(node) {
        var result, previousBase;
        previousBase = base;
        base += indent;
        result = ' catch (' + visitExpr(node.param) + ')';
        base = previousBase;
        return result + maybeBlock(node.body);
    }

    function generateConditionalExpression(node, prec) {
        return wrapWithPrecedence(
            visitExpr(node.test, Precedence.LogicalORExpression) + ' ? ' +
                visitExpr(node.consequent, Precedence.AssignmentExpression) + ' : ' +
                visitExpr(node.alternate, Precedence.AssignmentExpression),
            Precedence.ConditionalExpression,
            prec
        );
    }

    function generateContinueStatement(node) {
        if (node.label) {
            return 'continue ' + node.label.name + ';';
        }
        return 'continue;';
    }

    function generateDoWhileStatement(node) {
        return 'do' + maybeBlock(node.body, true) +
            'while (' + visitExpr(node.test) + ');';
    }

    function generateDebuggerStatement(node) {
        return 'debugger;';
    }

    function generateEmptyStatement(node) {
        return ';';
    }

    function generateExpressionStatement(node) {
        var type = node.expression.type,
            result = visitExpr(node.expression);

        // 12.4 '{', 'function' is not allowed in this position.
        // wrap espression with parentheses
        if (result[0] === '{' || result.indexOf('function ') === 0) {
            return '(' + result + ');';
        }
        return result + ';';
    }

    function generateVariableDeclarator(node) {
        if (node.init) {
            return node.id.name + ' = ' +
                visitExpr(node.init, Precedence.AssignmentExpression);
        }
        return node.id.name;
    }

    function generateVariableDeclaration(node) {
        var i, len, result, previousBase;

        result = node.kind + ' ';

        if (node.declarations.length === 1 && node.declarations[0].init &&
            node.declarations[0].init.type === 'FunctionExpression') {
            result += generateVariableDeclarator(node.declarations[0]);
        } else {
            previousBase = base;
            base += indent;
            for (i = 0, len = node.declarations.length; i < len; i += 1) {
                result += generateVariableDeclarator(node.declarations[i]);
                if ((i + 1) < len) {
                    result += ', ';
                }
            }
            base = previousBase;
        }

        return result + ';';
    }

    function generateForStatement(node) {
        var result, previousBase;

        previousBase = base;
        base += indent;
        result = 'for (';
        if (node.init) {
            if (node.init.type === 'VariableDeclaration') {
                result += visit(node.init);
            } else {
                result += visitExpr(node.init) + ';';
            }
        } else {
            result += ';';
        }
        
        if (node.test) {
            result += ' ' + visitExpr(node.test) + ';';
        } else {
            result += ';';
        }

        if (node.update) {
            result += ' ' + visitExpr(node.update) + ')';
        } else {
            result += ')';
        }

        base = previousBase;
        return result + maybeBlock(node.body);
    }

    function generateForInStatement(node) {
        var result, previousBase;

        result = 'for (';

        if (node.left.type === 'VariableDeclaration') {
            previousBase = base;
            base += indent + indent;
            result += node.left.kind + ' ' + generateVariableDeclarator(node.left.declarations[0]);
            base = previousBase;
        } else {
            previousBase = base;
            base += indent;
            result += visitExpr(node.left);
            base = previousBase;
        }
        
        previousBase = base;
        base += indent;
        result += ' in ' + visitExpr(node.right) + ')';
        base = previousBase;
        return result + maybeBlock(node.body);
    }

    function generateFunctionBody(node) {
        var result, i, len;
        result = '(';
        for (i = 0, len = node.params.length; i < len; i += 1) {
            result += node.params[i].name;
            if ((i + 1) < len) {
                result += ', ';
            } else {
                break;
            }
        }
        return result + ')' + maybeBlock(node.body);
    }

    function generateFunctionExpression(node) {
        var result;
        
        result = 'function ';
        if (node.id) {
            result += node.id.name;
        }
        return result + generateFunctionBody(node);
    }

    function generateFunctionDeclaration(node) {
        return generateFunctionExpression(node);
    }

    function generateIdentifier(node) {
        return node.name;
    }

    function generateIfStatement(node) {
        var result, previousBase;
        if (node.alternate) {
            if (node.alternate.type === 'IfStatement') {
                previousBase = base;
                base += indent;
                result = 'if (' + visitExpr(node.test) + ')';
                base = previousBase;
                return result + maybeBlock(node.consequent, true) +
                    'else ' + generateIfStatement(node.alternate);
            }
            previousBase = base;
            base += indent;
            result = 'if (' + visitExpr(node.test) + ')';
            base = previousBase;
            return result + maybeBlock(node.consequent, true) +
                'else' + maybeBlock(node.alternate);
        }
        previousBase = base;
        base += indent;
        result = 'if (' + visitExpr(node.test) + ')';
        base = previousBase;
        return result + maybeBlock(node.consequent);
    }

    function generateLiteral(node) {
        var value = node.value;

        if (value === null) {
            return 'null';
        }

        if (typeof value === 'string') {
            return escapeString(value);
        }

        if (typeof value === 'number' && value === Infinity) {
            return '1e1000';
        }

        return value.toString();
    }

    function generateLabeledStatement(node) {
        return node.label.name + ':' + maybeBlock(node.body);
    }

    function generateLogicalExpression(node, prec) {
        var current = binaryPrecedence(node.operator);
        return wrapWithPrecedence(
            visitExpr(node.left, current) + ' ' + node.operator + ' ' +
                visitExpr(node.right, current + 1),
            current,
            prec
        );
    }

    function generateMemberExpression(node, prec) {
        var result;
        result = visitExpr(node.object, Precedence.CallExpression);
        if (node.computed) {
            result += '[' + visitExpr(node.property) + ']';
        } else {
            if (node.object.type === 'Literal' && typeof node.object.value === 'number') {
                if (result.indexOf('.') < 0 && !/[eE]/.test(result)) {
                    result += '.';
                }
            }
            result += '.' + node.property.name;
        }
        return wrapWithPrecedence(result, Precedence.MemberExpression, prec);
    }

    function generateNewExpression(node, prec) {
        var result, i, len;

        result = 'new ' + visitExpr(node.callee, Precedence.NewExpression) + '(';
        for (i = 0, len = node['arguments'].length; i < len; i += 1) {
            result += visitExpr(node['arguments'][i], Precedence.AssignmentExpression);
            if ((i + 1) < len) {
                result += ', ';
            }
        }
        result += ')';

        return wrapWithPrecedence(result, Precedence.NewExpression, prec);
    }

    function generateObjectExpression(node, prec) {
        var result, i, len, property, previousBase;

        if (!node.properties.length) {
            return '{}';
        }

        result = '{\n';

        previousBase = base;
        base += indent;
        for (i = 0, len = node.properties.length; i < len; i += 1) {
            property = node.properties[i];
            if (property.kind === 'get' || property.kind === 'set') {
                result += addIndent(
                    property.kind + ' ' + visitExpr(property.key) +
                        generateFunctionBody(property.value)
                );
            } else {
                result += addIndent(
                    visitExpr(property.key) + ': ' +
                        visitExpr(property.value, Precedence.AssignmentExpression)
                );
            }
            if ((i + 1) < len) {
                result += ',\n';
            }
        }
        base = previousBase;

        return result + '\n' + addIndent('}');
    }

    function generateProgram(node) {
        var i, len, result = '';

        for (i = 0, len = node.body.length; i < len; i += 1) {
            result += visit(node.body[i]);
            if ((i + 1) < len) {
                result += '\n';
            } else {
                break;
            }
        }

        return result;
    }

    function generateReturnStatement(node) {
        if (node.argument) {
            return 'return ' + visit(node.argument) + ';';
        }
        return 'return;';
    }

    function generateSequenceExpression(node, prec) {
        var result, i, len;

        result = '';
        for (i = 0, len = node.expressions.length; i < len; i += 1) {
            result += visitExpr(node.expressions[i], Precedence.AssignmentExpression);
            if ((i + 1) < len) {
                result += ', ';
            }
        }

        return wrapWithPrecedence(result, Precedence.SequenceExpression, prec);
    }

    function generateSwitchCase(node) {
        var result, i, len, previousBase;

        previousBase = base;
        base += indent;
        if (node.test) {
            result = 'case ' + visitExpr(node.test) + ':';
        } else {
            result = 'default:';
        }


        i = 0;
        len = node.consequent.length;
        if (len && node.consequent[0].type === 'BlockStatement') {
            result += maybeBlock(node.consequent[0]);
            i = 1;
        }

        for (; i < len; i += 1) {
            result += '\n' + addIndent(visit(node.consequent[i]));
        }
        base = previousBase;

        return result;
    }

    function generateSwitchStatement(node) {
        var result, i, len;

        previousBase = base;
        base += indent;
        result = 'switch (' + visitExpr(node.discriminant) + ') {\n';
        base = previousBase;

        if (node.cases) {
            for (i = 0, len = node.cases.length; i < len; i += 1) {
                result += addIndent(generateSwitchCase(node.cases[i])) + '\n';
            }
        }

        return result + addIndent('}');
    }

    function generateThisExpression(node) {
        return 'this';
    }

    function generateThrowStatement(node) {
        return 'throw ' + visit(node.argument) + ';';
    }

    function generateTryStatement(node) {
        var result, i, len, handler;

        result = 'try' + maybeBlock(node.block);

        for (i = 0, len = node.handlers.length; i < len; i += 1) {
            result += generateCatchClause(node.handlers[i]);
        }

        if (node.finalizer) {
            result += ' finally' + maybeBlock(node.finalizer);
        }

        return result;
    }

    function generateUnaryExpression(node, prec) {
        var op;

        switch (node.operator) {
        case 'delete':
        case 'void':
        case 'typeof':
            op = node.operator + ' ';
            break;
        default:
            op = node.operator;
        }

        return wrapWithPrecedence(
            op + visitExpr(node.argument, Precedence.UnaryExpression),
            Precedence.UnaryExpression,
            prec
        );
    }

    function generateUpdateExpression(node, prec) {
        if (node.prefix) {
            return generateUnaryExpression(node, prec);
        } else {
            return wrapWithPrecedence(
                visitExpr(node.argument, Precedence.PostfixExpression) +
                    node.operator,
                Precedence.PostfixExpression,
                prec
            );
        }
    }

    function generateWhileStatement(node) {
        var result, previousBase;
        previousBase = base;
        base += indent;
        result = 'while (' + visitExpr(node.test) + ')';
        base = previousBase;
        result += maybeBlock(node.body);
        return result;
    }

    function generateWithStatement(node) {
        var result, previousBase;
        previousBase = base;
        base += indent;
        result = 'with (' + visitExpr(node.object) + ')';
        base = previousBase;
        result += maybeBlock(node.body);
        return result;
    }

    Generator = {
        AssignmentExpression: generateAssignmentExpression,
        ArrayExpression: generateArrayExpression,
        BlockStatement: generateBlockStatement,
        BinaryExpression: generateBinaryExpression,
        BreakStatement: generateBreakStatement,
        CallExpression: generateCallExpression,
        CatchClause: generateCatchClause,
        ConditionalExpression: generateConditionalExpression,
        ContinueStatement: generateContinueStatement,
        DoWhileStatement: generateDoWhileStatement,
        DebuggerStatement: generateDebuggerStatement,
        EmptyStatement: generateEmptyStatement,
        ExpressionStatement: generateExpressionStatement,
        ForStatement: generateForStatement,
        ForInStatement: generateForInStatement,
        FunctionDeclaration: generateFunctionDeclaration,
        FunctionExpression: generateFunctionExpression,
        Identifier: generateIdentifier,
        IfStatement: generateIfStatement,
        Literal: generateLiteral,
        LabeledStatement: generateLabeledStatement,
        LogicalExpression: generateLogicalExpression,
        MemberExpression: generateMemberExpression,
        NewExpression: generateNewExpression,
        ObjectExpression: generateObjectExpression,
        Program: generateProgram,
        ReturnStatement: generateReturnStatement,
        SequenceExpression: generateSequenceExpression,
        SwitchStatement: generateSwitchStatement,
        SwitchCase: generateSwitchCase,
        ThisExpression: generateThisExpression,
        ThrowStatement: generateThrowStatement,
        TryStatement: generateTryStatement,
        UnaryExpression: generateUnaryExpression,
        UpdateExpression: generateUpdateExpression,
        VariableDeclaration: generateVariableDeclaration,
        VariableDeclarator: generateVariableDeclarator,
        WhileStatement: generateWhileStatement,
        WithStatement: generateWithStatement
    };

    exports.generate = generate;
}(typeof exports === 'undefined' ? (striker = {}) : exports));
/* vim: set sw=4 ts=4 et tw=80 : */
