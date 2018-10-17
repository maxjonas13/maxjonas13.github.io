import * as React from 'react';
import './nav.css';


export default class Nav extends React.Component{

  render() {
    return (
      <div className="nav" style={{  backgroundImage: this.props.NavBackground }}>
        <nav className="nav--inner">

          <a href="/portfolio" className={"nav--link " + ((this.props.active === 'portfolio') ? "nav--active" : "" )}>portfolio</a>
          <a href="/Motivation" className={"nav--link " + ((this.props.active === 'motivation') ? "nav--active" : "" )}>Motivation</a>

        </nav>
      </div>
    );
  }
};
