import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCKS_COUNT, canPlace, generateBlocks, isFilled, rotateCells } from '../js/puzzles/blocks.js';
import { FLOOD_COUNT, applyMoves, flood, generateFlood, isUniform } from '../js/puzzles/flood.js';
import {
  PIPES_COUNT,
  flow,
  generatePipes,
  isSolved as pipesSolved,
  maskOf,
  solvedCopy,
} from '../js/puzzles/pipes.js';
import { LEVELS, isSolved as sokobanSolved, loadLevel, solve, tryMove } from '../js/puzzles/sokoban.js';
import { WATER_COUNT, generateWater, isSolved as waterSolved, pour, pourAmount, replay } from '../js/puzzles/water.js';

test('pipe levels are solvable trees and the scramble is not already finished', () => {
  assert.ok(PIPES_COUNT >= 30);
  let previous = 0;
  for (let level = 0; level < PIPES_COUNT; level++) {
    const puzzle = generatePipes(level);
    assert.equal(puzzle.n * puzzle.n, puzzle.cells.length);
    assert.ok(puzzle.n >= previous);
    previous = puzzle.n;
    const solved = solvedCopy(puzzle);
    assert.equal(pipesSolved(solved), true, `level ${level} solution`);
    assert.equal(flow(solved).wet.size, puzzle.n * puzzle.n, `level ${level} fills the tree`);
    assert.equal(pipesSolved(puzzle), false, `level ${level} starts open`);
    const sinks = puzzle.cells.filter((cell) => cell.role === 'sink');
    assert.ok(sinks.length >= 1);
    for (let i = 0; i < solved.cells.length; i++) {
      const mask = maskOf(solved.cells[i]);
      const x = i % puzzle.n;
      const y = (i / puzzle.n) | 0;
      for (const [bit, dx, dy, back] of [
        [1, 0, -1, 4],
        [2, 1, 0, 8],
        [4, 0, 1, 1],
        [8, -1, 0, 2],
      ]) {
        if (!(mask & bit)) continue;
        const nx = x + dx;
        const ny = y + dy;
        assert.ok(nx >= 0 && ny >= 0 && nx < puzzle.n && ny < puzzle.n);
        assert.ok(maskOf(solved.cells[ny * puzzle.n + nx]) & back, `level ${level} joint ${i}`);
      }
    }
  }
});

test('block pieces are an exact cover of the target shape', () => {
  assert.ok(BLOCKS_COUNT >= 30);
  const mono = rotateCells(
    [
      [0, 0],
      [1, 0],
    ],
    0,
  );
  assert.deepEqual(mono, [
    [0, 0],
    [1, 0],
  ]);
  for (let level = 0; level < BLOCKS_COUNT; level++) {
    const puzzle = generateBlocks(level);
    assert.equal(isFilled(puzzle, puzzle.pieces), false);
    const placed = puzzle.pieces.map((piece) => ({
      ...piece,
      placed: true,
      rot: 0,
      x: piece.homeX,
      y: piece.homeY,
    }));
    assert.equal(isFilled(puzzle, placed), true, `level ${level}`);
    for (const piece of puzzle.pieces) {
      assert.equal(canPlace(puzzle, placed, piece, piece.homeX, piece.homeY, 0), true);
    }
    const again = generateBlocks(level);
    assert.equal(again.pieces.length, puzzle.pieces.length);
    assert.deepEqual(again.mask, puzzle.mask);
  }
});

test('water sort scrambles are undone by the recorded pours', () => {
  assert.ok(WATER_COUNT >= 30);
  for (let level = 0; level < WATER_COUNT; level++) {
    const puzzle = generateWater(level);
    assert.equal(waterSolved(puzzle.tubes), false, `level ${level} starts mixed`);
    for (const tube of puzzle.tubes) assert.ok(tube.length <= puzzle.cap);
    let state = puzzle.tubes.map((tube) => tube.slice());
    for (const [from, to] of puzzle.solution) {
      const amount = pourAmount(state, from, to, puzzle.cap);
      assert.ok(amount > 0, `level ${level} pour ${from}->${to}`);
      state = pour(state, from, to, puzzle.cap);
    }
    assert.equal(waterSolved(state), true, `level ${level} solved`);
    assert.deepEqual(replay(puzzle.tubes, puzzle.solution, puzzle.cap), state);
    const same = generateWater(level);
    assert.deepEqual(same.tubes, puzzle.tubes);
  }
});

test('flood boards are cleared by the greedy line within the move limit', () => {
  assert.ok(FLOOD_COUNT >= 30);
  let previous = 0;
  for (let level = 0; level < FLOOD_COUNT; level++) {
    const puzzle = generateFlood(level);
    assert.ok(puzzle.size >= previous);
    previous = puzzle.size;
    assert.equal(isUniform(puzzle.board), false);
    assert.ok(puzzle.solution.length >= 1);
    assert.ok(puzzle.solution.length <= puzzle.limit);
    const done = applyMoves(puzzle.board, puzzle.solution);
    assert.equal(isUniform(done), true, `level ${level}`);
    const untouched = flood(puzzle.board, puzzle.board[0][0]);
    assert.deepEqual(untouched, puzzle.board);
    const other = (puzzle.board[0][0] + 1) % puzzle.colors;
    const changed = flood(puzzle.board, other);
    assert.equal(changed[0][0], other);
    assert.equal(isUniform(puzzle.board), false);
  }
});

test('every sokoban level has a real solution and rejects a push into a wall', () => {
  assert.ok(LEVELS.length >= 30);
  const first = loadLevel(0);
  assert.equal(sokobanSolved(first), false);
  const pushed = tryMove(first, 'right');
  assert.ok(pushed);
  assert.equal(sokobanSolved(pushed), true);
  assert.equal(tryMove(first, 'up'), null);

  for (let index = 0; index < LEVELS.length; index++) {
    const level = loadLevel(index);
    assert.equal(level.boxes.length, level.goals.size, LEVELS[index].name);
    assert.equal(sokobanSolved(level), false, LEVELS[index].name);
    const path = solve(level);
    assert.ok(path && path.length > 0, `${LEVELS[index].name} solvable`);
    let state = level;
    for (const dir of path) {
      const next = tryMove(state, dir);
      assert.ok(next, `${LEVELS[index].name} ${dir}`);
      state = next;
    }
    assert.equal(sokobanSolved(state), true, LEVELS[index].name);
  }
});
