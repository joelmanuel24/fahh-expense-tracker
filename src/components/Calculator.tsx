import React, { useState, useEffect } from 'react';

interface CalculatorProps {
  isOpen: boolean;
  initialValue: string;
  onConfirm: (finalValue: number) => void;
  onClose: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ isOpen, initialValue, onConfirm, onClose }) => {
  const [formula, setFormula] = useState<string>('0');
  const [result, setResult] = useState<number>(0);

  // Synchronize initial value when calculator opens
  useEffect(() => {
    if (isOpen) {
      const val = parseFloat(initialValue) || 0;
      setFormula(val > 0 ? val.toString() : '0');
      setResult(val);
    }
  }, [isOpen, initialValue]);

  // Safe mathematical parser supporting basic operations and parentheses
  const evaluateFormula = (expr: string): number => {
    // Only allow digits, decimals, basic operators, and parentheses
    const sanitized = expr.replace(/[^0-9.+\-*/()]/g, '');
    if (!sanitized) return 0;
    try {
      const evalFn = new Function(`return ${sanitized}`);
      const res = evalFn();
      return typeof res === 'number' && isFinite(res) ? res : 0;
    } catch (e) {
      return 0;
    }
  };

  const handleKeyPress = (val: string) => {
    let nextFormula = formula;

    if (val === 'C') {
      nextFormula = '0';
    } else if (val === '()') {
      const openParenthesesCount = (formula.match(/\(/g) || []).length;
      const closeParenthesesCount = (formula.match(/\)/g) || []).length;
      const lastChar = formula.slice(-1);
      
      if (openParenthesesCount > closeParenthesesCount && !['+', '-', '*', '/'].includes(lastChar) && lastChar !== '(') {
        nextFormula = formula + ')';
      } else {
        if (formula === '0') {
          nextFormula = '(';
        } else {
          nextFormula = formula + '(';
        }
      }
    } else if (val === '%') {
      const lastChar = formula.slice(-1);
      if (/[0-9)]/.test(lastChar)) {
        nextFormula = formula + '/100';
      }
    } else if (val === '+/-') {
      // Toggle negative/positive sign of the last numeric chunk
      const match = formula.match(/(-?[0-9.]+)$/);
      if (match) {
        const lastNum = match[1];
        const prevPart = formula.slice(0, -lastNum.length);
        if (lastNum.startsWith('-')) {
          nextFormula = prevPart + lastNum.slice(1);
        } else {
          nextFormula = prevPart + '-' + lastNum;
        }
      }
    } else if (val === '=') {
      const finalRes = evaluateFormula(formula);
      nextFormula = finalRes.toString();
    } else {
      // Prevent double operators
      const lastChar = formula.slice(-1);
      const isOperator = ['+', '-', '*', '/'].includes(val);
      const isLastCharOperator = ['+', '-', '*', '/'].includes(lastChar);

      if (isOperator && isLastCharOperator) {
        // Replace previous operator
        nextFormula = formula.slice(0, -1) + val;
      } else {
        if (formula === '0' && !isOperator && val !== '.') {
          nextFormula = val;
        } else {
          nextFormula = formula + val;
        }
      }
    }

    setFormula(nextFormula);
    
    // Live update result preview
    let tempExpr = nextFormula;
    if (['+', '-', '*', '/'].includes(tempExpr.slice(-1))) {
      tempExpr = tempExpr.slice(0, -1);
    }
    const liveRes = evaluateFormula(tempExpr);
    setResult(liveRes);
  };

  const handleConfirm = () => {
    const finalRes = evaluateFormula(formula);
    onConfirm(finalRes);
  };

  return (
    <div className={`calculator-panel ${isOpen ? '' : 'hidden'}`}>
      {/* Drag Indicator and live equation screen */}
      <div className="calc-panel-header">
        <div className="calc-drag-indicator" onClick={onClose} style={{ cursor: 'pointer' }}></div>
        <div className="calc-display-line">
          <span className="calc-equation" id="calc-formula-display">{formula}</span>
          <span className="calc-result" id="calc-result-display">PHP {result.toFixed(2)}</span>
        </div>
      </div>

      {/* 5x4 Keypad Grid Layout matching user's layout design reference */}
      <div className="calc-grid">
        <button type="button" className="calc-btn clear" onClick={() => handleKeyPress('C')}>C</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('()')}>()</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('%')}>%</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('/')}>÷</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('7')}>7</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('8')}>8</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('9')}>9</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('*')}>×</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('4')}>4</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('5')}>5</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('6')}>6</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('-')}>−</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('1')}>1</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('2')}>2</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('3')}>3</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('+')}>+</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('+/-')}>+/-</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('0')}>0</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('.')}>.</button>
        <button type="button" className="calc-btn evaluate" onClick={() => handleKeyPress('=')}>=</button>

        <button type="button" className="calc-btn confirm primary" onClick={handleConfirm}>✓ Confirm</button>
      </div>
    </div>
  );
};
