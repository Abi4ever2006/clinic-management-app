import React from 'react';

const EmptyState = ({ icon, title, description, action, actionLabel }) => {
    return (
        <div className="text-center py-12 px-4">
            <p className="text-5xl mb-4">{icon}</p>
            <h3 className="text-gray-600 font-medium text-lg">{title}</h3>
            {description && (
                <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
                    {description}
                </p>
            )}
            {action && actionLabel && (
                <button
                onClick={action}
                className="btn-primary mt-4 text-sm"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;