import * as React from 'react';
import './disclaimer.css';

export default class Disclaimer extends React.Component{
  render() {
    return (
      <div className="disclaimer"  data-image-src={this.props.disclaimerBackground} style={{  backgroundImage: this.props.disclaimerBackground }}>
        <div className="disclaimer--inner">
          <h1 className="disclaimer--title">Disclaimer</h1>
          <div className="disclaimer--content">
            The Work you see in This Portfolio is not owned by me. This is owned by Wunderman and all its Customers. Please do not share this link.
            This is purely to show you what I'm capable of. I do not make profit of this content.
            Personal showcases are to old for this Portfolio and do not reflect the capacities I have.
          </div>
        </div>
      </div>
    );
  }
};
