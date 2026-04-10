import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Alert, Tabs, Tab, InputGroup, Modal } from 'react-bootstrap';
import axios from 'axios';
import { User, RecurringSchedule, OneTimeAccess } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { MdAdd } from 'react-icons/md';

interface GuestScheduleManagementProps {
    user: User;
}

const ScheduleManagement: React.FC<GuestScheduleManagementProps> = ({ user }) => {
    const { token } = useAuth();
    const [recurringSchedules, setRecurringSchedules] = useState([]);
    const [oneTimeAccess, setOneTimeAccess] = useState([]);
    const [newRecurringSchedule, setNewRecurringSchedule] = useState({ 
        day_of_week: 0, 
        start_time: '09:00',
        end_time: '17:00'
    });
    const [newOneTimeAccess, setNewOneTimeAccess] = useState({ 
        start_date: '', 
        end_date: '', 
        start_time: '09:00',
        end_time: '17:00'
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [endDateManuallySet, setEndDateManuallySet] = useState(false);
    const [showAddRecurringModal, setShowAddRecurringModal] = useState(false);
    const [showAddOneTimeModal, setShowAddOneTimeModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [scheduleType, setScheduleType] = useState<'recurring' | 'onetime'>('recurring');

    const fetchSchedules = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/guests/${user.id}/schedules`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRecurringSchedules(response.data.recurring_schedules);
            setOneTimeAccess(response.data.one_time_access);
        } catch (error) {
            console.error('Failed to fetch guest schedules:', error);
            setError('Failed to fetch guest schedules. Please try again.');
        }
    }, [user, token]);

    useEffect(() => {
        fetchSchedules();
    }, [user, fetchSchedules]);

    const handleAddRecurringSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Send times in HH:mm format
            const formattedSchedule = {
                day_of_week: newRecurringSchedule.day_of_week,
                start_time: newRecurringSchedule.start_time,  // Already in HH:mm format
                end_time: newRecurringSchedule.end_time      // Already in HH:mm format
            };
            
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/guests/${user.id}/recurring-schedules`,
                formattedSchedule,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Recurring schedule added successfully');
            fetchSchedules();
            setNewRecurringSchedule({ day_of_week: 0, start_time: '09:00', end_time: '17:00' });
        } catch (error) {
            console.error('Failed to add recurring schedule:', error);
            setError('Failed to add recurring schedule. Please try again.');
        }
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartDate = e.target.value;
        setNewOneTimeAccess(prev => ({
            ...prev,
            start_date: newStartDate,
            // Only set end_date if it hasn't been manually modified
            end_date: !endDateManuallySet ? newStartDate : prev.end_date
        }));
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDateManuallySet(true);
        setNewOneTimeAccess(prev => ({
            ...prev,
            end_date: e.target.value
        }));
    };

    const handleAddOneTimeAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Send times in HH:mm format
            const formattedAccess = {
                start_date: newOneTimeAccess.start_date,
                end_date: newOneTimeAccess.end_date,
                start_time: newOneTimeAccess.start_time,  // Already in HH:mm format
                end_time: newOneTimeAccess.end_time      // Already in HH:mm format
            };

            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/guests/${user.id}/one-time-accesses`,
                formattedAccess,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('One-time access added successfully');
            fetchSchedules();
            setEndDateManuallySet(false);
            setNewOneTimeAccess({ start_date: '', end_date: '', start_time: '09:00', end_time: '17:00' });
        } catch (error) {
            console.error('Failed to add one-time access:', error);
            setError('Failed to add one-time access. Please try again.');
        }
    };

    const handleRemoveRecurringSchedule = async (scheduleId: RecurringSchedule['id']) => {
        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/guests/recurring-schedules/${scheduleId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSuccess('Recurring schedule removed successfully');
            fetchSchedules();
        } catch (error) {
            console.error('Failed to remove recurring schedule:', error);
            setError('Failed to remove recurring schedule. Please try again.');
        }
    };

    const handleRemoveOneTimeAccess = async (accessId: OneTimeAccess['id']) => {
        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/guests/one-time-accesses/${accessId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSuccess('One-time access removed successfully');
            fetchSchedules();
        } catch (error) {
            console.error('Failed to remove one-time access:', error);
            setError('Failed to remove one-time access. Please try again.');
        }
    };

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Helper function to format time from HH:mm:ss to HH:mm
    const formatTime = (time: string) => {
        return time.substring(0, 5); // Takes only HH:mm part
    };

    return (
        <div className="position-relative">
            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

            <Tabs defaultActiveKey="recurring" id="guest-schedule-tabs">
                <Tab eventKey="recurring" title="Recurring Schedule">
                    {/* Header Section */}
                    <div className="d-flex justify-content-end align-items-center mt-3 mb-4">
                        <Button 
                            variant="light"
                            className="border-0 d-flex align-items-center gap-2 shadow-sm hover-lift"
                            style={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(8px)',
                                transition: 'all 0.2s ease-in-out'
                            }}
                            onClick={() => setShowAddRecurringModal(true)}
                        >
                            <MdAdd size={20} />
                            <span>Add Schedule</span>
                        </Button>
                    </div>

                    <Table responsive hover className="shadow-sm">
                        <thead className="bg-light">
                            <tr>
                                <th>Day of Week</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recurringSchedules.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-4 text-muted">
                                        No recurring schedules found
                                    </td>
                                </tr>
                            ) : (
                                recurringSchedules.map((schedule: RecurringSchedule) => (
                                    <tr key={schedule.id}>
                                        <td>{daysOfWeek[schedule.day_of_week]}</td>
                                        <td>{formatTime(schedule.start_time)}</td>
                                        <td>{formatTime(schedule.end_time)}</td>
                                        <td className="text-end">
                                            <Button 
                                                variant="outline-danger" 
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedSchedule(schedule);
                                                    setScheduleType('recurring');
                                                    setShowDeleteModal(true);
                                                }}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </Tab>

                <Tab eventKey="oneTime" title="One-Time Access">
                    {/* Similar header section for one-time access */}
                    <div className="d-flex justify-content-end align-items-center mt-3 mb-4">
                        <Button 
                            variant="light"
                            className="border-0 d-flex align-items-center gap-2 shadow-sm hover-lift"
                            style={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(8px)',
                                transition: 'all 0.2s ease-in-out'
                            }}
                            onClick={() => setShowAddOneTimeModal(true)}
                        >
                            <MdAdd size={20} />
                            <span>Add Access</span>
                        </Button>
                    </div>

                    <Table responsive hover className="shadow-sm">
                        <thead className="bg-light">
                            <tr>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {oneTimeAccess.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-muted">
                                        No one-time access found
                                    </td>
                                </tr>
                            ) : (
                                oneTimeAccess.map((access: OneTimeAccess) => (
                                    <tr key={access.id}>
                                        <td>{access.start_date}</td>
                                        <td>{access.end_date}</td>
                                        <td>{formatTime(access.start_time)}</td>
                                        <td>{formatTime(access.end_time)}</td>
                                        <td className="text-end">
                                            <Button 
                                                variant="outline-danger" 
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedSchedule(access);
                                                    setScheduleType('onetime');
                                                    setShowDeleteModal(true);
                                                }}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </Tab>
            </Tabs>

            {/* Add Recurring Schedule Modal */}
            <Modal show={showAddRecurringModal} onHide={() => setShowAddRecurringModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add Recurring Schedule</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAddRecurringSchedule}>
                        <InputGroup className="mb-3">
                            <InputGroup.Text>Day of Week</InputGroup.Text>
                            <Form.Select
                                value={newRecurringSchedule.day_of_week}
                                onChange={(e) => setNewRecurringSchedule({ ...newRecurringSchedule, day_of_week: parseInt(e.target.value) })}
                                aria-label="Day of Week"
                            >
                                {daysOfWeek.map((day, index) => (
                                    <option key={index} value={index}>{day}</option>
                                ))}
                            </Form.Select>
                        </InputGroup>

                        <InputGroup className="mb-3">
                            <InputGroup.Text>Time Range</InputGroup.Text>
                            <Form.Control
                                type="time"
                                value={newRecurringSchedule.start_time}
                                onChange={(e) => setNewRecurringSchedule({ ...newRecurringSchedule, start_time: e.target.value })}
                                aria-label="Start Time"
                            />
                            <InputGroup.Text>to</InputGroup.Text>
                            <Form.Control
                                type="time"
                                value={newRecurringSchedule.end_time}
                                onChange={(e) => setNewRecurringSchedule({ ...newRecurringSchedule, end_time: e.target.value })}
                                aria-label="End Time"
                            />
                        </InputGroup>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddRecurringModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleAddRecurringSchedule}>
                        Add Schedule
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Add One-Time Access Modal */}
            <Modal show={showAddOneTimeModal} onHide={() => setShowAddOneTimeModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add One-Time Access</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAddOneTimeAccess}>
                        <InputGroup className="mb-3">
                            <InputGroup.Text>Date</InputGroup.Text>
                            <Form.Control
                                type="date"
                                value={newOneTimeAccess.start_date}
                                onChange={handleStartDateChange}
                                aria-label="Start Date"
                            />
                            <InputGroup.Text>to</InputGroup.Text>
                            <Form.Control
                                type="date"
                                value={newOneTimeAccess.end_date}
                                onChange={handleEndDateChange}
                                aria-label="End Date"
                            />
                        </InputGroup>

                        <InputGroup className="mb-3">
                            <InputGroup.Text>Time Range</InputGroup.Text>
                            <Form.Control
                                type="time"
                                value={newOneTimeAccess.start_time}
                                onChange={(e) => setNewOneTimeAccess({ ...newOneTimeAccess, start_time: e.target.value })}
                                aria-label="Start Time"
                            />
                            <InputGroup.Text>to</InputGroup.Text>
                            <Form.Control
                                type="time"
                                value={newOneTimeAccess.end_time}
                                onChange={(e) => setNewOneTimeAccess({ ...newOneTimeAccess, end_time: e.target.value })}
                                aria-label="End Time"
                            />
                        </InputGroup>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddOneTimeModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleAddOneTimeAccess}
                        disabled={!newOneTimeAccess.start_date || !newOneTimeAccess.end_date}
                    >
                        Add Access
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete this {scheduleType === 'recurring' ? 'schedule' : 'access'}?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={() => {
                            if (scheduleType === 'recurring') {
                                handleRemoveRecurringSchedule(selectedSchedule.id);
                            } else {
                                handleRemoveOneTimeAccess(selectedSchedule.id);
                            }
                            setShowDeleteModal(false);
                        }}
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ScheduleManagement;
