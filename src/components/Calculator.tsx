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

  // Safe mathematical parser
  const evaluateFormula = (expr: string): number => {
    // Only allow digits, decimals, and basic math operators
    const sanitized = expr.replace(/[^0-9.+\-*/]/g, '');
    if (!sanitized) return 0;
    try {
      // Safe execution of mathematical expression since it is fully sanitized
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
    } else if (val === 'backspace') {
      nextFormula = formula.slice(0, -1);
      if (nextFormula === '' || nextFormula === '-') {
        nextFormula = '0';
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
    
    // Live update result preview (evaluate up to last number)
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

      {/* 4x5 Keypad Grid */}
      <div className="calc-grid">
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('7')}>7</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('8')}>8</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('9')}>9</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('/')}>/</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('4')}>4</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('5')}>5</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('6')}>6</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('*')}>*</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('1')}>1</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('2')}>2</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('3')}>3</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('-')}>-</button>

        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('0')}>0</button>
        <button type="button" className="calc-btn number" onClick={() => handleKeyPress('.')}>.</button>
        <button type="button" className="calc-btn backspace" onClick={() => handleKeyPress('backspace')}>⌫</button>
        <button type="button" className="calc-btn operator" onClick={() => handleKeyPress('+')}>+</button>

        <button type="button" className="calc-btn clear double-width" onClick={() => handleKeyPress('C')}>C</button>
        <button type="button" className="calc-btn evaluate" onClick={() => handleKeyPress('=')}>=</button>
        <button type="button" className="calc-btn confirm primary" onClick={handleConfirm}>✓ Confirm</button>
      </div>
    </div>
  );
};
