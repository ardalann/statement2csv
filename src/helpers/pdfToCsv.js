import PDFJS from "pdfjs-dist";
import moment from "moment";

/**
 * Fix for the following error:
 * ./node_modules/pdfjs-dist/build/pdf.js
 * Critical dependency: require function is used in a way in which dependencies cannot be statically extracted
 */
PDFJS.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.1.266/pdf.worker.js';

const settings = {
  rowsBeginning: /^DATE$/g,
  rowsEnding: /^NEW BALANCE$/g,
  rowBeginning: /^[A-Z]{3} [0-9]{2}$/g,
  rowEnding: null, // /^[0-9]{2}\.[0-9]{2}$/g,
  ignoreNumeric: true,
  replacements: [
    {
      search: "CALGARY AB",
      replace: ""
    },
    {
      search: /^([A-Z]{3} [0-9]{2})[ ]{2,4}[A-Z]{3} [0-9]{2}[ ]{1,2}(.*)$/g,
      replace: "$1{SPLIT}$2"
    },
    {
      search: /\$([0-9]),([0-9]{3})/g,
      replace: "$1$2"
    },
    {
      search: /(-?)\$([0-9]+\.[0-9]{2})$/g,
      replace: "$1$2"
    }
  ],
  joins: [
    {
      search: /^Foreign Currency-(.*)$/g,
      replace: " ($1",
      join: 1
    },
    {
      search: /^Exchange rate-(.*)$/g,
      replace: " - Rate $1)",
      join: 1
    }
  ],
  columnTitles: [
    "Date",
    "Description",
    "Amount"
    // 'Category',
  ],
  dateColumn: 0,
  inputDatePattern: "ll DD",
  outputDatePattern: "L"
  // descriptionColumn: 1,
  // categoryColumn: 3,
  // categories: [
  //   {
  //     search: 'TIM',
  //     category: '"Restaurants, Coffee & Bars"',
  //   },
  // ],
};

const extractPageRows = textContentItems => {
  let cells = [];
  let rows = [];
  let foundBeginning = false;

  textContentItems.forEach(item => {
    if (item.str.match(settings.rowsBeginning)) {
      foundBeginning = true;
    } else if (item.str.match(settings.rowsEnding)) {
      foundBeginning = false;
    } else if (settings.ignoreNumeric && !isNaN(item.str)) {
      // Skip
    } else if (foundBeginning) {
      let str = item.str;

      settings.replacements.forEach(replacement => {
        str = str.replace(replacement.search, replacement.replace);
      });

      str = str.trim();

      // console.log('str', str);

      let strArr = str
        .split(/\{SPLIT\}/g)
        .map(st => st.trim())
        .filter(st => st.length > 0);

      // console.log('item2cells', item, strArr);

      cells.push(...strArr);
    }
  });

  // console.log('cells', cells);

  const pushRow = row => {
    // console.log('pushRow', row);

    row[settings.dateColumn] = moment(
      row[settings.dateColumn],
      settings.inputDatePattern
    ).format(settings.outputDatePattern);

    // if (settings.categoryColumn || settings.categoryColumn.length === 0) {
    //   row[settings.categoryColumn] = '';
    //   settings.categories.forEach(categoryInfo => {
    //     if (row[settings.categoryColumn].length > 0) return; // Already found

    //     if (row[settings.descriptionColumn].search(categoryInfo.search) > -1) {
    //       row[settings.categoryColumn] = categoryInfo.category;
    //     }
    //   });
    // }

    row.forEach((cell, key) => {
      settings.joins.forEach(join => {
        if (row[key].search(join.search) > -1) {
          row[key] = row[key].replace(join.search, join.replace);
          row[join.join] += row[key];
          row.splice(key, 1);
        }
      });
    });

    // console.log('pushed', row);

    rows.push(row);

    if (row.length !== settings.columnTitles.length) {
      console.warn("Invalid row length", row);
    }
  };

  let row = [];

  // console.log('cells to iterate', cells);

  cells.forEach(cell => {
    if (settings.rowBeginning && cell.match(settings.rowBeginning)) {
      if (row.length > 0) {
        pushRow(row);
        row = [];
      }
      row.push(cell);
    } else if (settings.rowEnding && cell.match(settings.rowEnding)) {
      row.push(cell);
      pushRow(row);
      row = [];
    } else {
      row.push(cell);
    }
  });

  if (row.length > 0) {
    // console.log('Last row',row);
    pushRow(row);
    row = [];
  }

  return rows;
};

const importPages = (PDF, pageNum, rows) => {
  pageNum = pageNum || 1;
  rows = rows || [settings.columnTitles];

  return PDF.getPage(pageNum).then(page =>
    page.getTextContent().then(textContent => {
      rows.push(...extractPageRows(textContent.items));

      if (pageNum < PDF.numPages) {
        return importPages(PDF, pageNum + 1, rows);
      } else {
        return rows;
      }
    })
  );
};

export default pdfArrayBuffer => {
  return PDFJS.getDocument(pdfArrayBuffer)
    .then(PDF => importPages(PDF))
    .then(rows =>
      rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n")
    );
};
