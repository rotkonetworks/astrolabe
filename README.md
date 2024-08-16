# Astrolabe Geospatial Encoding

## Overview

This repository contains the source code for Astrolabe, a framework for encoding
and decoding geospatial data into BGP communities. The project includes a web-based
interface for interacting with the encoding/decoding process and a Rust/WASM library
that powers the underlying logic.

### Structure

- **www/**: Contains the web application, including the home page for encoding/decoding
operations and the "About" page that provides an overview of Astrolabe.
- **src/lib/**: Contains the core logic written in Rust and compiled to
WebAssembly (WASM), which handles the geospatial encoding and decoding operations.
- **tests/**: Contains test cases for validating the functionality of the
Rust/WASM code.
- **Cargo.toml**: The manifest file for the Rust project, defining dependencies
and project metadata.

## Getting Started

### Prerequisites

Before you can build and run the project, ensure you have the following installed:

- **Rust**: Make sure you have Rust installed. You can install it from [rust-lang.org](https://www.rust-lang.org/).
- **Wasm-Pack**: Used to compile the Rust code to WebAssembly. Install it via:
  ```bash
  cargo install wasm-pack
  ```
- **Node.js & npm**: Required to build and serve the web application. You can install Node.js from [nodejs.org](https://nodejs.org/).

### Building the Project

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/yourusername/astrolabe.git
   cd astrolabe
   ```

2. **Build the Rust/WASM Library:**
   Navigate to the root of the project and run:
   ```bash
   wasm-pack build --target web --out-dir www
   ```
   This command will compile the Rust code to WebAssembly and place the generated files in the `pkg/` directory.

3. **Install and Build the Web Application:**
   Navigate to the `www/` directory and install the dependencies:
   ```bash
   cd www
   npm install
   npm run build
   ```
   This will create a production-ready version of the web application in the `dist/` directory.

### Running the Web Application

To start a development server and view the web application:

```bash
cd www
npm start
```

This will launch a local development server. Open your browser and navigate to
`http://localhost:3000` to see the home page.

#### Example Usage

Here’s how the Rust functions might be called in the web application:

```javascript
import init, { encode_latitude, decode_latitude } from './pkg/astrolabe_lib';

async function run() {
  await init();

  const encoded = encode_latitude(13.75822);
  console.log("Encoded:", encoded);

  const decoded = decode_latitude(encoded);
  console.log("Decoded:", decoded);
}

run();
```

## Testing

To run the test suite for the Rust/WASM code, execute the following command:

```bash
cargo test
```

This will run all the test cases defined in the `tests/` directory to ensure that the encoding and decoding logic is functioning correctly.

## Contributing

Contributions are welcome! If you find a bug or have an idea for a new feature, feel free to open an issue or submit a pull request.

### How to Contribute

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes and commit them (`git commit -m 'Add new feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Contact

For more information, please contact [tommi@rotko.net](mailto:tommi@rotko.net).
