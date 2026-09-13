// LAB-3519 scratch: verify the JSX bind/arrow rule no longer fires
import React from "react";

class ScratchComponent extends React.Component {
  handleClick() {
    console.log("clicked");
  }

  render() {
    return (
      <div>
        <button onClick={() => this.handleClick()}>Arrow handler</button>
        <button onClick={this.handleClick.bind(this)}>Bind handler</button>
      </div>
    );
  }
}

export default ScratchComponent;
