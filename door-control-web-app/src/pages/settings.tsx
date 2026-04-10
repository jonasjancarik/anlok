import { useState } from 'react';
import { Container, Tab, Tabs, Row, Col } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import UserProfile from '../components/settings/UserProfile';
import UserManagement from '../components/settings/UserManagement';
import ApartmentManagement from '../components/settings/ApartmentManagement';

const Settings = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

    return (
        <Container fluid className="py-3 flex-grow-1 overflow-auto">
            <Row>
                <Col>
                    <h2>Settings</h2>
                    <Tabs
                        activeKey={activeTab}
                        onSelect={(k) => k && setActiveTab(k)}
                        className="mb-3"
                    >
                        <Tab eventKey="profile" title="Profile">
                            <UserProfile />
                        </Tab>
                        <Tab eventKey="users" title="Users">
                            <UserManagement isActive={activeTab === 'users'} />
                        </Tab>
                        {user && user.role === 'admin' && (
                            <Tab eventKey="apartments" title="Apartments">
                                <ApartmentManagement />
                            </Tab>
                        )}
                    </Tabs>
                </Col>
            </Row>
        </Container>
    );
};

export default Settings;
