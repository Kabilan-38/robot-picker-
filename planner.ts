// A simple Priority Queue implementation
class PriorityQueue<T> {
    private elements: { item: T; priority: number }[] = [];

    enqueue(item: T, priority: number) {
        this.elements.push({ item, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    dequeue(): T | undefined {
        return this.elements.shift()?.item;
    }

    isEmpty(): boolean {
        return this.elements.length === 0;
    }
}

export interface Point { x: number; y: number; }
export interface Shelf { id: string; items: string[]; pos: Point; }

export interface WorldState {
  robotPos: Point;
  holding: string | null;
  itemLocations: Record<string, string>;
}

export interface Action {
  type: 'MOVE' | 'PICK' | 'DROP';
  params: {
    from?: Point;
    to?: Point;
    path?: Point[];
    item?: string;
    shelfId?: string;
  };
  cost: number;
}

export interface PlannerResult {
    path: Action[];
    iterations: number;
}

const manhattanDistance = (a: Point, b: Point): number => {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};


// --- Grid Pathfinding (A* for movement) ---
const findPath = (start: Point, end: Point, obstacles: Point[], gridSize: number): Point[] | null => {
    const openSet = new PriorityQueue<Point>();
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    
    const pointToString = (p: Point) => `${p.x},${p.y}`;
    const stringToPoint = (s: string) => { const [x,y] = s.split(',').map(Number); return {x,y}; };

    const obstacleSet = new Set(obstacles.map(pointToString));

    gScore.set(pointToString(start), 0);
    openSet.enqueue(start, manhattanDistance(start, end));

    while(!openSet.isEmpty()){
        const current = openSet.dequeue()!;
        if(current.x === end.x && current.y === end.y){
            const path: Point[] = [];
            let currStr = pointToString(current);
            while(cameFrom.has(currStr)){
                path.unshift(stringToPoint(currStr));
                currStr = cameFrom.get(currStr)!;
            }
            path.unshift(start);
            return path;
        }

        const neighbors: Point[] = [
            {x: current.x + 1, y: current.y}, {x: current.x - 1, y: current.y},
            {x: current.x, y: current.y + 1}, {x: current.x, y: current.y - 1}
        ].filter(p => 
            p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize && !obstacleSet.has(pointToString(p))
        );

        for(const neighbor of neighbors){
            const tentativeGScore = (gScore.get(pointToString(current)) || 0) + 1;
            if(tentativeGScore < (gScore.get(pointToString(neighbor)) || Infinity)){
                cameFrom.set(pointToString(neighbor), pointToString(current));
                gScore.set(pointToString(neighbor), tentativeGScore);
                openSet.enqueue(neighbor, tentativeGScore + manhattanDistance(neighbor, end));
            }
        }
    }
    return null; // No path
}

// --- High-level State Planning ---

const stateToString = (state: WorldState): string => {
    const items = Object.entries(state.itemLocations).sort(([a], [b]) => a.localeCompare(b)).map(([item, loc]) => `${item}:${loc}`).join(',');
    return `${state.robotPos.x},${state.robotPos.y}|${state.holding}|${items}`;
};

const isGoal = (state: WorldState, goalItems: string[]): boolean => {
    return goalItems.every(item => state.itemLocations[item] === 'collectionPoint');
};

const getSuccessors = (state: WorldState, goalItems: string[], shelves: Shelf[], collectionPoint: Point, obstacles: Point[], gridSize: number): Action[] => {
    const actions: Action[] = [];
    const neededItems = goalItems.filter(item => state.itemLocations[item] !== 'collectionPoint' && state.itemLocations[item] !== 'robot');

    if (state.holding) {
        // If holding an item, move to the collection point.
        const path = findPath(state.robotPos, collectionPoint, obstacles, gridSize);
        if (path) {
            if(path.length > 1) { // Path includes start, so length > 1 means there's a move
                actions.push({ type: 'MOVE', params: { from: state.robotPos, to: collectionPoint, path }, cost: path.length - 1 });
            } else { // Already at the collection point
                actions.push({ type: 'DROP', params: { item: state.holding }, cost: 1 });
            }
        }
    } else {
        // If hand is empty, can move to a shelf with a needed item, or pick an item if at such a shelf.
        const currentShelf = shelves.find(s => s.pos.x === state.robotPos.x && s.pos.y === state.robotPos.y);
        if (currentShelf) {
            const itemToPick = currentShelf.items.find(item => neededItems.includes(item));
            if (itemToPick) {
                actions.push({ type: 'PICK', params: { item: itemToPick, shelfId: currentShelf.id }, cost: 1 });
            }
        }
        
        // Generate moves to shelves with needed items
        const targetShelves = shelves.filter(s => s.items.some(item => neededItems.includes(item)));
        for (const shelf of targetShelves) {
             const path = findPath(state.robotPos, shelf.pos, obstacles, gridSize);
             if (path && path.length > 1) {
                 actions.push({ type: 'MOVE', params: { from: state.robotPos, to: shelf.pos, path }, cost: path.length - 1 });
             }
        }
    }
    return actions;
};

const applyAction = (state: WorldState, action: Action): WorldState => {
    const newState = JSON.parse(JSON.stringify(state));
    switch (action.type) {
        case 'MOVE':
            newState.robotPos = action.params.to;
            break;
        case 'PICK':
            newState.holding = action.params.item;
            newState.itemLocations[action.params.item] = 'robot';
            break;
        case 'DROP':
            newState.itemLocations[action.params.item] = 'collectionPoint';
            newState.holding = null;
            break;
    }
    return newState;
};

const heuristic = (state: WorldState, goalItems: string[], collectionPoint: Point, obstacles: Point[], gridSize: number): number => {
    let h = 0;
    const itemsToGet = goalItems.filter(item => state.itemLocations[item] !== 'collectionPoint');
    h += itemsToGet.length * 20; // High cost for each uncollected item

    if (state.holding) {
        const path = findPath(state.robotPos, collectionPoint, obstacles, gridSize);
        h += path ? path.length - 1 : Infinity; // Use real path distance for heuristic
    }
    return h;
};


export const aStarPlanner = (
    initialState: WorldState, 
    goalItems: string[], 
    shelves: Shelf[], 
    collectionPoint: Point,
    obstacles: Point[],
    gridSize: number,
): PlannerResult | null => {
    
    const openSet = new PriorityQueue<{ state: WorldState; path: Action[] }>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const startStateKey = stateToString(initialState);
    gScore.set(startStateKey, 0);
    const initialHeuristic = heuristic(initialState, goalItems, collectionPoint, obstacles, gridSize);
    fScore.set(startStateKey, initialHeuristic);
    openSet.enqueue({ state: initialState, path: [] }, fScore.get(startStateKey)!);
    
    let iterations = 0;
    const maxIterations = 5000;

    while (!openSet.isEmpty()) {
        iterations++;
        if (iterations > maxIterations) {
            console.error("Planner timed out: max iterations reached.");
            return null; // Safety break
        }

        const { state: currentState, path: currentPath } = openSet.dequeue()!;
        const currentStateKey = stateToString(currentState);

        if (isGoal(currentState, goalItems)) {
            return { path: currentPath, iterations };
        }

        const successors = getSuccessors(currentState, goalItems, shelves, collectionPoint, obstacles, gridSize);

        for (const action of successors) {
            const nextState = applyAction(currentState, action);
            const nextStateKey = stateToString(nextState);
            const tentativeGScore = (gScore.get(currentStateKey) || 0) + action.cost;

            if (tentativeGScore < (gScore.get(nextStateKey) || Infinity)) {
                gScore.set(nextStateKey, tentativeGScore);
                const h = heuristic(nextState, goalItems, collectionPoint, obstacles, gridSize);
                fScore.set(nextStateKey, tentativeGScore + h);
                const newPath = [...currentPath, action];
                openSet.enqueue({ state: nextState, path: newPath }, fScore.get(nextStateKey)!);
            }
        }
    }

    return null; // No path found
};