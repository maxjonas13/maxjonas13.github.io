import * as React from 'react';
import './card.css';
import './card-container.css';

export default class Card extends React.Component{

  // componentDidMount() {
  //   this.parallax = new Parallax(this.scene)
  // }
  // componentWillUnmount() {
  //   this.parallax.disable()
  // }
// <div ref={el => this.scene = el} dataDepth="0.50" className="card parallax-window" data-parallax="scroll" data-image-src={this.props.cardBackground} style={{  backgroundImage: this.props.cardBackground }}>
  render() {
    return (
      <div className="card"  data-image-src={this.props.cardBackground} style={{  backgroundImage: this.props.cardBackground }}>
        <div className="card--inner">
          <h1 className="card--title">{this.props.cardTitle}</h1>

          <div className="card--content">

            { this.props.cardContentType === "image" &&
                <a href={this.props.cardContentLinkExt} target="_blank"><img src={this.props.cardContentLink} className="card--image" alt="card" /></a>
            }

            { this.props.cardContentType === "iframe" &&
              <iframe src={this.props.cardContentLink} title="ok" className="card--iframe" width="300" height="250" border="0" scrolling="no" allowtransparency="true"></iframe>
            }

          </div>

          <div className="card--text">
            <p>{this.props.cardText}</p>
            <p className="card--legal">{this.props.cardLegal}</p>
          </div>

        </div>
      </div>
    );
  }
};
