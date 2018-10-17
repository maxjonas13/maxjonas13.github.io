import * as React from 'react';
import './title.css';


export default class Title extends React.Component{

  render() {
    return (
        <h1 className={this.props.classes}>
          <span>{this.props.copy}</span>
        </h1>
    );
  }
};
