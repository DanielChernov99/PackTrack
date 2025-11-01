import React from "react";
import Header from "./Header.jsx";

const Layout = ({ children, user }) => {
    return (
        <>
            <Header user={user} />
            <main>{children}</main>
        </>
    );
};

export default Layout;