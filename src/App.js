import React, { Component } from 'react';
import PDFJS from 'pdfjs-dist';
import moment from 'moment';
import logo from './logo.svg';
import './App.css';

class App extends Component {
  constructor() {
    super(...arguments);

    this.state = {
      rows: [],
    };

    this.settings = {
      rowsBeginning: /^DATE$/g,
      rowsEnding: /^NEW BALANCE$/g,
      rowBeginning: /^[A-Z]{3} [0-9]{2}$/g,
      rowEnding: null,
      ignoreNumeric: true,
      replacements: [
        {
          search: 'CALGARY AB',
          replace: '',
        },
        {
          search: /^([A-Z]{3} [0-9]{2})[ ]{3}[A-Z]{3} [0-9]{2}[ ]{2}(.*)$/g,
          replace: '$1{SPLIT}$2',
        },
        {
          search: /\$([0-9]),([0-9]{3})/g,
          replace: '$1$2',
        },
        {
          search: /(\-?)\$([0-9]+\.[0-9]{2})$/g,
          replace: '$1$2',
        },
      ],
      joins: [
        {
          search: /^Foreign Currency\-(.*)$/g,
          replace: ' ($1',
          join: 1,
        },
        {
          search: /^Exchange rate\-(.*)$/g,
          replace: ' - Rate $1)',
          join: 1,
        },
      ],
      columnTitles: [
        'Date',
        'Description',
        'Amount',
        // 'Category',
      ],
      dateColumn: 0,
      inputDatePattern: 'll DD',
      outputDatePattern: 'L',
      // descriptionColumn: 1,
      // categoryColumn: 3,
      // categories: [
      //   {
      //     search: 'TIM',
      //     category: '"Restaurants, Coffee & Bars"',
      //   },
      // ],
    };
  }
  componentDidMount() {
    PDFJS.getDocument('test.pdf').then(PDF => {
      this.importPages(PDF);
    });
  }
  importPages(PDF, pageNum, rows) {
    pageNum = pageNum || 1;
    rows = rows || [this.settings.columnTitles];

    PDF.getPage(pageNum).then(page => {
      page.getTextContent().then(textContent => {
        rows.push(...this.extractPageRows(textContent.items));
        
        if (pageNum < PDF.numPages) {
          this.importPages(PDF, pageNum + 1, rows);
        } else {
          this.setState({rows: rows});
        }
      });
    });
  }
  extractPageRows(textContentItems) {
    let cells = [];
    let rows = [];
    let foundBeginning = false;

    textContentItems.forEach(item => {
      if (item.str.match(this.settings.rowsBeginning)) {
        foundBeginning = true;
      } else if (item.str.match(this.settings.rowsEnding)) {
        foundBeginning = false;
      } else if (this.settings.ignoreNumeric && !isNaN(item.str)) {
        // Skip
      } else if (foundBeginning) {
        let str = item.str;

        this.settings.replacements.forEach(replacement => {
          str = str.replace(replacement.search, replacement.replace);
        });

        str = str.trim();

        let strArr = str
          .split(/\{SPLIT\}/g)
          .map(st => st.trim())
          .filter(st => st.length > 0);

        cells.push(...strArr);
      }
    });

    const pushRow = (row) => {
      row[this.settings.dateColumn] = moment(row[this.settings.dateColumn], this.settings.inputDatePattern).format(this.settings.outputDatePattern);

      // if (this.settings.categoryColumn || this.settings.categoryColumn.length === 0) {
      //   row[this.settings.categoryColumn] = '';
      //   this.settings.categories.forEach(categoryInfo => {
      //     if (row[this.settings.categoryColumn].length > 0) return; // Already found

      //     if (row[this.settings.descriptionColumn].search(categoryInfo.search) > -1) {
      //       row[this.settings.categoryColumn] = categoryInfo.category;
      //     }
      //   });
      // }
      
      row.forEach((cell, key) => {
        this.settings.joins.forEach(join => {
          if (row[key].search(join.search) > -1) {
            row[key] = row[key].replace(join.search, join.replace);
            row[join.join] += row[key];
            row.splice(key, 1);
          }
        });
      });

      rows.push(row);

      if (row.length !== this.settings.columnTitles.length) {
        console.warn('Invalid row length', row);
      }
    };

    let row = [];

    cells.forEach(cell => {
      if (this.settings.rowBeginning && cell.match(this.settings.rowBeginning)) {
        if (row.length > 0) {
          pushRow(row);
          row = [];
        }
        row.push(cell);
      } else if (this.settings.rowEnding && cell.match(this.settings.rowEnding)) {
        row.push(cell);
        pushRow(row);
        row = [];
      } else {
        row.push(cell);
      }
    });

    if (row.length > 0) {
      pushRow(row);
      row = [];
    }

    return rows;
  }
  render() {
    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to React</h2>
        </div>
        <div className="App-intro">
          {this.state.rows.map((row, key) => 
            <div key={key + row}>
              {row.map(cell => `"${cell}"`).join(',')}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default App;
