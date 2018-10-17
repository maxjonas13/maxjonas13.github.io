import * as React from 'react';
import logo from '../../portfolio-logo.svg';
import Nav from '../Nav/Nav';
import './header.css';

export default class Header extends React.Component{

  render() {
    return (
        <header className="app-header header">
          <img src={logo} className="header--logo" alt="logo" />
          <Nav active={this.props.active} />
        </header>
    );
  }
};
