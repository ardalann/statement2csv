import React, { Component } from "react";
import pdfToCsv from "./helpers/pdfToCsv";
import "./App.css";

class App extends Component {
  state = {
    encodedCsv: "",
    fileName: ""
  };
  handleUpload = e => {
    const generatedFileName = this._input.files[0].name.replace(".pdf", ".csv");

    const reader = new FileReader();
    const _this = this;
    reader.onload = function() {
      const arrayBuffer = this.result;
      pdfToCsv(arrayBuffer).then(csv => {
        _this.setState({
          encodedCsv: `data:text/csv;charset=utf-8,${encodeURI(csv).replace(/#/g, "-")}`,
          fileName: generatedFileName
        });
      });
    };
    reader.readAsArrayBuffer(this._input.files[0]);
  };
  render() {
    return (
      <div className="App">
        <div className="App-intro">
          <input
            className="App-input"
            type="file"
            ref={ref => (this._input = ref)}
            onChange={this.handleUpload}
          />
          <a
            className="App-link"
            ref={ref => (this._link = ref)}
            href={this.state.encodedCsv}
            download={this.state.fileName}
          >
            {this.state.fileName}
          </a>
        </div>
      </div>
    );
  }
}

export default App;
