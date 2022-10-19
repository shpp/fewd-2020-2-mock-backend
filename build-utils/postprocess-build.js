/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
/*
  this is post-processing script for compiled worker.js/index.mjs
  1) remove sourcesContent from sourceMap
  2) trim a bit sourceMap.sources so file lengths are not long
  3) remove comments
  4) for ESM builds, remove imports of some Node stuff like Buffer or process

  NOTE: this postprocess-build.js is supposed to work with old webpack and new rollup builders
*/
const fs = require('fs');

function main() {
  const filename = fs.existsSync('dist/worker.js') ? 'dist/worker.js' : 'dist/index.mjs';
  // const justfilename = filename.split('/')[filename.split('/').length - 1];
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
  global.atob = (b64Encoded) => Buffer.from(b64Encoded, 'base64').toString('binary');

  const rollup = fs.existsSync('rollup.config.js');
  if (rollup || !('' + fs.readFileSync('webpack.config.js')).match(/\n[ \t]+mode: .production./)) {
    // TODO: fix this or add more node.js cutout modules!
    const textorig = ('' + fs.readFileSync(filename))
      .replace("import { Buffer } from 'buffer';", '')
      .replace("import process from 'process';", '');

    let lines = textorig.split('\n');
    fs.writeFileSync(filename + '.orig', lines.join('\n'));

    const lastLine = lines[lines.length - 1];
    let [beforeMap, sourceMap] = lastLine.includes('base64')
      ? lastLine.split('sourceMappingURL=')[1].split('base64,')
      : ['data:application/json;charset=utf-8;', '' + fs.readFileSync(filename + '.map')];
    sourceMap = JSON.parse(sourceMap.startsWith('{') ? sourceMap : atob(sourceMap));

    // point 1
    sourceMap.sourcesContent = '';
    sourceMap.file = '';
    // point 2
    sourceMap.sources = sourceMap.sources.map((x) =>
      rollup
        ? x.replace(/^\.\.\//, '')
        : //
          x.split(/\/\.\//)[1] || 'khm'
    );

    sourceMap = btoa(JSON.stringify(sourceMap));

    // always false
    let sourceMapStr = '';
    if (!sourceMap) {
      sourceMapStr =
        '; var buildMetadata=' +
        JSON.stringify({ time: Date.now() }) +
        ' ; ' +
        'var sourceMappingURL="' +
        `${beforeMap}base64,${sourceMap}` +
        '"' +
        ' ;';
      lines[lines.length] = sourceMapStr;
    } else {
      lines[lines.length - 1] = '';
      sourceMapStr =
        '; var buildMetadata=' +
        JSON.stringify({ time: Date.now() }) +
        ' ; ' +
        'var sourceMappingURL="' +
        `${beforeMap}base64,${sourceMap}` +
        '"' +
        ' ;';
      lines[0] = sourceMapStr + lines[0];
    }

    // point 3: remove comments and empty spaces
    let res = !rollup
      ? lines
          .map((x) => x.trim())
          .join('\n')
          // NOTE: MAY NOT WORK FOR MULTILINE STRING!
          // res = res.replace(/\n[ \t]+/g, "\n")
          .replace(/\n[ \t]*\/\*(.*?)\*\//gs, (a, b) => {
            if (b.substring(1).includes('\n')) return '\n' + b.replace(/[^\n]/g, '');
            return '\n';
          })
          .replace(/ \/\/[^/"\n]*\n/g, '\n')
          .replace(/\n[ \t]*\/\/.*/g, '\n')
      : lines
          // rollup cleanup plugin did everything for us...
          .map((x) => x.trim())
          .join('\n');
    fs.writeFileSync(filename, res);

    const buildstats = fs.existsSync(filename + '.buildstats.json')
      ? outputStats(JSON.parse('' + fs.readFileSync(filename + '.buildstats.json')))
      : undefined;

    const change = buildstats
      ? (((res.length - sourceMapStr.length) / buildstats.total) * 100).toFixed(1) +
        '% of orig build stats ' +
        buildstats.total
      : undefined;
    console.log(
      `${filename} without sourcemap len = ${res.length - sourceMapStr.length}` + (change ? ` (${change})` : '')
    );
    console.log(
      `${filename} sourcemap len = ${sourceMapStr.length}` +
        ` (${((sourceMapStr.length / res.length) * 100).toFixed(1)}% of total res len ${res.length})`
    );
    console.log(`${filename} sourcemap json len = ${JSON.stringify(sourceMap).length} `);
    console.log(`${filename} len = ${res.length}`);
  } else {
    console.log(`${filename} len = ${('' + fs.readFileSync(filename)).length}`);
  }
  const wranglerToml = '' + fs.readFileSync('./wrangler.toml');

  if (wranglerToml.includes('xxxxx') || wranglerToml.includes('XXXXX') || wranglerToml.includes('.....')) {
    console.log('ERROR: please remove stub values from wrangler.toml');
  }
}

function outputStats(args) {
  args.totals.sort((a, b) => b.size - a.size);
  console.log('%s:', args.input);

  args.totals.forEach((item) => {
    const itemSize = item.size || 0;

    console.log('- %s - %s (%s%%)', item.name, filesize(itemSize), ((itemSize / args.total) * 100).toFixed(1));

    if (args.options.details || item.name === 'app') {
      args.data[item.name]
        .sort((a, b) => b.size - a.size)
        .forEach((file) =>
          console.log(
            '  - %s - %s (%s%%)',
            file.path.includes('node_modules') ? file.path.split('node_modules')[1] : file.path,
            filesize(file.size || 0),
            ((file.size / itemSize) * 100).toFixed(1)
          )
        );
    }
  });
  console.log('total = ' + args.total);
  // console.log(JSON.stringify(args));
  return args;
}

const filesize = (() => {
  var b = /^(b|B)$/,
    symbol = {
      iec: {
        bits: ['bit', 'Kibit', 'Mibit', 'Gibit', 'Tibit', 'Pibit', 'Eibit', 'Zibit', 'Yibit'],
        bytes: ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
      },
      jedec: {
        bits: ['bit', 'Kbit', 'Mbit', 'Gbit', 'Tbit', 'Pbit', 'Ebit', 'Zbit', 'Ybit'],
        bytes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      },
    },
    fullform = {
      iec: ['', 'kibi', 'mebi', 'gibi', 'tebi', 'pebi', 'exbi', 'zebi', 'yobi'],
      jedec: ['', 'kilo', 'mega', 'giga', 'tera', 'peta', 'exa', 'zetta', 'yotta'],
    },
    roundingFuncs = {
      floor: Math.floor,
      ceil: Math.ceil,
    };

  function filesize(arg) {
    var descriptor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var result = [],
      val = 0,
      e,
      base,
      bits,
      ceil,
      full,
      fullforms,
      locale,
      localeOptions,
      neg,
      num,
      output,
      pad,
      round,
      u,
      unix,
      separator,
      spacer,
      standard,
      symbols,
      roundingFunc,
      precision;

    if (isNaN(arg)) {
      throw new TypeError('Invalid number');
    }

    bits = descriptor.bits === true;
    unix = descriptor.unix === true;
    pad = descriptor.pad === true;
    base = descriptor.base || 10;
    round = descriptor.round !== void 0 ? descriptor.round : unix ? 1 : 2;
    locale = descriptor.locale !== void 0 ? descriptor.locale : '';
    localeOptions = descriptor.localeOptions || {};
    separator = descriptor.separator !== void 0 ? descriptor.separator : '';
    spacer = descriptor.spacer !== void 0 ? descriptor.spacer : unix ? '' : ' ';
    symbols = descriptor.symbols || {};
    standard = base === 2 ? descriptor.standard || 'iec' : 'jedec';
    output = descriptor.output || 'string';
    full = descriptor.fullform === true;
    fullforms = descriptor.fullforms instanceof Array ? descriptor.fullforms : [];
    e = descriptor.exponent !== void 0 ? descriptor.exponent : -1;
    roundingFunc = roundingFuncs[descriptor.roundingMethod] || Math.round;
    num = Number(arg);
    neg = num < 0;
    ceil = base > 2 ? 1000 : 1024;
    precision = isNaN(descriptor.precision) === false ? parseInt(descriptor.precision, 10) : 0; // Flipping a negative number to determine the size

    if (neg) {
      num = -num;
    } // Determining the exponent

    if (e === -1 || isNaN(e)) {
      e = Math.floor(Math.log(num) / Math.log(ceil));

      if (e < 0) {
        e = 0;
      }
    } // Exceeding supported length, time to reduce & multiply

    if (e > 8) {
      if (precision > 0) {
        precision += 8 - e;
      }

      e = 8;
    }

    if (output === 'exponent') {
      return e;
    } // Zero is now a special case because bytes divide by 1

    if (num === 0) {
      result[0] = 0;
      u = result[1] = unix ? '' : symbol[standard][bits ? 'bits' : 'bytes'][e];
    } else {
      val = num / (base === 2 ? Math.pow(2, e * 10) : Math.pow(1000, e));

      if (bits) {
        val = val * 8;

        if (val >= ceil && e < 8) {
          val = val / ceil;
          e++;
        }
      }

      var p = Math.pow(10, e > 0 ? round : 0);
      result[0] = roundingFunc(val * p) / p;

      if (result[0] === ceil && e < 8 && descriptor.exponent === void 0) {
        result[0] = 1;
        e++;
      }

      u = result[1] = base === 10 && e === 1 ? (bits ? 'kbit' : 'kB') : symbol[standard][bits ? 'bits' : 'bytes'][e];

      if (unix) {
        result[1] = result[1].charAt(0);

        if (b.test(result[1])) {
          result[0] = Math.floor(result[0]);
          result[1] = '';
        }
      }
    } // Decorating a 'diff'

    if (neg) {
      result[0] = -result[0];
    } // Setting optional precision

    if (precision > 0) {
      result[0] = result[0].toPrecision(precision);
    } // Applying custom symbol

    result[1] = symbols[result[1]] || result[1];

    if (locale === true) {
      result[0] = result[0].toLocaleString();
    } else if (locale.length > 0) {
      result[0] = result[0].toLocaleString(locale, localeOptions);
    } else if (separator.length > 0) {
      result[0] = result[0].toString().replace('.', separator);
    }

    if (pad && Number.isInteger(result[0]) === false && round > 0) {
      var x = separator || '.',
        tmp = result[0].toString().split(x),
        s = tmp[1] || '',
        l = s.length,
        n = round - l;
      result[0] = ''
        .concat(tmp[0])
        .concat(x)
        .concat(s.padEnd(l + n, '0'));
    }

    if (full) {
      result[1] = fullforms[e]
        ? fullforms[e]
        : fullform[standard][e] + (bits ? 'bit' : 'byte') + (result[0] === 1 ? '' : 's');
    } // Returning Array, Object, or String (default)

    return output === 'array'
      ? result
      : output === 'object'
      ? {
          value: result[0],
          symbol: result[1],
          exponent: e,
          unit: u,
        }
      : result.join(spacer);
  } // Partial application for functional programming

  filesize.partial = function (opt) {
    return function (arg) {
      return filesize(arg, opt);
    };
  };

  return filesize;
})();

main();
