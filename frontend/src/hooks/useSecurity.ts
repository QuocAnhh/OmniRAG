import { useEffect } from 'react';

/**
 * Custom hook to enhance client-side security by disabling
 * common developer tools and inspection methods.
 */
export const useSecurity = () => {
    useEffect(() => {
        // 1. Disable Right Click (Context Menu)
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };

        // 2. Disable Keyboard Shortcuts for DevTools
        const handleKeyDown = (e: KeyboardEvent) => {
            // F12
            if (e.key === 'F12') {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+I (Inspect)
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+C (Element Inspector)
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                return false;
            }

            // Ctrl+U (View Source)
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                return false;
            }
        };

        // 3. Clear Console / Show Warning
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let savedConsole: any = {};

        // Check if running in production mode using Vite's import.meta.env
        // or standard NODE_ENV if process is available (fallback)
        const isProduction = import.meta.env.PROD;

        if (isProduction) {
            // Store original methods
            savedConsole = {
                log: console.log,
                warn: console.warn,
                error: console.error,
                info: console.info,
            };

            const noop = () => { };
            console.log = noop;
            console.warn = noop;
            console.error = noop;
            console.info = noop;
        } else {
            // Only show warning in dev or if prompt requested it for all envs.
            // User asked to "avoid user check console", which implies production users.
            // So we disabled it in PROD.

            // We can still emit the warning, but if we disabled console, it won't show.
            // So we keep the disabled console as the primary defense.
        }

        // Add Event Listeners
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        // Initial Warning - only useful if console is NOT disabled or if user forces it enabled
        if (!isProduction) {
            console.log(
                '%cStop! This is a browser feature intended for developers.',
                'color: red; font-size: 30px; font-weight: bold; -webkit-text-stroke: 1px black;'
            );
        }

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);

            // Restore console methods if we modified them
            if (isProduction && savedConsole.log) {
                console.log = savedConsole.log;
                console.warn = savedConsole.warn;
                console.error = savedConsole.error;
                console.info = savedConsole.info;
            }
        };
    }, []);
};
