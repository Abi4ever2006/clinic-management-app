import React from 'react';

const LoadingSpinner = ({ size = 'md', text = 'Loading...', fullPage = false}) => {
    const sizes = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-2',
        lg: 'w-12 h-12 border-4',
    };

    const spinner = (
        <div className="flex flex-col items-center justify-center gap-3">
            <div
            className={'${sizes[size]} border-blue-600 border-t-transparent rounded-full animate-spin'}
            />
            {text && (
                <p className="text-sm text-gray-500">{text}</p>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                {spinner}
            </div>
        );
    }

    return spinner;
};

export default LoadingSpinner;