import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, useAnimation } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const UnlockButton = () => {
    const [status, setStatus] = useState('Unlock Door');
    const [isButtonDisabled, setIsButtonDisabled] = useState(false);
    const controls = useAnimation();
    const { token } = useAuth();
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const resetButton = useCallback(() => {
        if (isMounted.current) {
            controls.start({ strokeDashoffset: 0, transition: { duration: 0.5, ease: 'linear' } });
            setIsButtonDisabled(false);
            setStatus("Unlock Door");
        }
    }, [controls]);

    const handleUnlock = useCallback(async () => {
        if (!isMounted.current) return;

        setIsButtonDisabled(true);
        setStatus('Unlocked...');

        controls.start({ strokeDashoffset: 364.424, transition: { duration: 10, ease: 'linear' } })
            .then(() => {
                if (isMounted.current) {
                    resetButton();
                }
            });

        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/doors/unlock`, null, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (isMounted.current) {
                setStatus('Unlock door');
            }
        } catch (error) {
            if (!isMounted.current) return;
            if (axios.isAxiosError(error) && error.response) {
                const { status, data } = error.response;
                if (status === 401) {
                    setStatus('You are not authorized to unlock the door. Try logging in again.');
                } else {
                    console.error('Error response:', error.response);
                    setStatus(data.error?.detail || 'Failed to unlock the door');
                }
            } else {
                console.error('Error:', error);
                setStatus('Failed to connect to the server');
            }
            resetButton();
        }
    }, [controls, resetButton, token]);

    return (
        <div className="text-center" id="unlock-button-container">
            <button 
                onClick={handleUnlock} 
                disabled={isButtonDisabled} 
                className="button-round text-black"
            >
                {isButtonDisabled ? 'Unlocked...' : status}
            </button>
            <motion.svg
                viewBox="0 0 120 120"
                className="svg-circle"
            >
                <motion.circle
                    cx="60"
                    cy="60"
                    r="58"
                    fill="none"
                    stroke="#343434"
                    strokeWidth="4"
                    strokeDasharray="364.424"
                    strokeDashoffset="0"
                    animate={controls}
                    initial={{ strokeDashoffset: 0 }}
                />
            </motion.svg>
        </div>
    );
};

export default UnlockButton;
