
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly string[];
}

const Select: React.FC<SelectProps> = ({ label, options, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <select
        id={id}
        className="w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 text-content dark:text-dark-content border border-base-300 dark:border-dark-base-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
        {...props}
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
};

export default Select;
