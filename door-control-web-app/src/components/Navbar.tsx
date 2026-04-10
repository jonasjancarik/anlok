import { Navbar, Nav, Container } from 'react-bootstrap';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { MdHome, MdSettings  } from "react-icons/md";
import { useAuth } from '../contexts/AuthContext';

const AppNavbar = () => {
    const { user } = useAuth();
    const router = useRouter();

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
    }, [router]);

    return (
        <Navbar bg="dark" variant="dark" expand="lg">
            <Container fluid>
                <Navbar.Brand className='mb-0 d-lg-block d-none' as={Link} href="/">
                    {process.env.NEXT_PUBLIC_WEB_APP_TITLE}
                </Navbar.Brand>
                {user ? (
                    <>
                        <div className='ms-auto d-none d-lg-flex'>
                            <Navbar.Toggle aria-controls="basic-navbar-nav" />
                            <Navbar.Collapse id="basic-navbar-nav">
                                <Nav className='ms-auto'>
                                    <Nav.Link>{process.env.NEXT_PUBLIC_WEB_APP_SUBTITLE}</Nav.Link>
                                    <Nav.Link as={Link} href="/settings">Settings</Nav.Link>
                                </Nav>
                            </Navbar.Collapse>
                        </div>
                        <div className="d-lg-none d-flex justify-content-around w-100">
                            <Nav.Link as={Link} href="/">
                                <MdHome size={36} color='fffdf4' />
                            </Nav.Link>
                            <Nav.Link as={Link} href="/settings">
                                <MdSettings size={36} color="fffdf4" />
                            </Nav.Link>
                        </div>
                    </>
                ) : null}
            </Container>
        </Navbar>
    );
};

export default AppNavbar;
