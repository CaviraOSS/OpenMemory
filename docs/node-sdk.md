# Node SDK Reference

The `openmemory-node` package provides a TypeScript/JavaScript interface.

## Installation

```bash
npm install openmemory-js
```

## Usage

```typescript
import { Memory } from 'openmemory-js';

const mem = new Memory();
```

### API

#### `mem.add(content, options)`

Stores a memory.

- `content` (string): The text to memorize.
- `options.user_id` (string): The owner of the memory.
- `options.tags` (string[]): Optional tags.

```javascript
await mem.add("User likes spicy food", { 
  user_id: "user_1", 
  tags: ["food", "preference"] 
});
```

#### `mem.search(query, options)`

Retrieves relevant context.

- `query` (string): The question or topic.
- `options.user_id` (string): Required.
- `options.limit` (number): Max results (default 5).

```javascript
const results = await mem.search("What food to order?", { user_id: "user_1" });
console.log(results[0].content); 
// "User likes spicy food"
```

## Server Mode

The Node package also contains the API server.

```bash
# Start the server on port 8080
npx openmemory-js serve
# or
npx opm serve
```
