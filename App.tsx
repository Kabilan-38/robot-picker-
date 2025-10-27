import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Section } from './components/Section';
import { CodeBlock } from './components/CodeBlock';
import { RobotIcon, BoxIcon, FlagIcon, CheckCircleIcon, CpuChipIcon, LightBulbIcon, DocumentTextIcon, ChartBarIcon, ArrowUturnLeftIcon, PlayIcon, StopIcon, ForwardIcon, BackwardIcon, CubeTransparentIcon, ArchiveBoxArrowDownIcon, StopCircleIcon } from './components/Icons';
import { aStarPlanner, WorldState, Action, Point, Shelf, PlannerResult } from './planner';

const GRID_SIZE = 8;
const CELL_SIZE = 48; // md:w-12
const CELL_GAP = 4; // gap-1
const PADDING = 8; // p-2

const App: React.FC = () => {
  const shelfLayout: Shelf[] = useMemo(() => [
    { id: 'S1', items: ['ItemA'], pos: { x: 1, y: 4 } },
    { id: 'S2', items: ['ItemB'], pos: { x: 4, y: 1 } },
    { id: 'S3', items: ['ItemC'], pos: { x: 6, y: 5 } },
    { id: 'S4', items: ['ItemD'], pos: { x: 2, y: 7 } },
  ], []);

  const obstacles: Point[] = useMemo(() => [
    {x: 3, y: 3}, {x: 4, y: 3}, {x: 5, y: 3}, {x: 3, y: 4}, {x: 3, y: 5}
  ], []);

  const robotStart: Point = useMemo(() => ({ x: 0, y: 0 }), []);
  const collectionPoint: Point = useMemo(() => ({ x: 0, y: 0 }), []);
  const allItems = useMemo(() => Array.from(new Set(shelfLayout.flatMap(s => s.items))), [shelfLayout]);

  const [itemsToPick, setItemsToPick] = useState<string[]>(['ItemA', 'ItemC']);
  const [planResult, setPlanResult] = useState<PlannerResult | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulation state
  const [simulationStep, setSimulationStep] = useState(-1);
  const [currentSimState, setCurrentSimState] = useState<WorldState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(800);
  const plan = planResult?.path ?? null;

  const initialWorldState: WorldState = useMemo(() => {
    const itemLocations: Record<string, string> = {};
    shelfLayout.forEach(shelf => {
      shelf.items.forEach(item => {
        itemLocations[item] = shelf.id;
      });
    });
    return {
      robotPos: robotStart,
      holding: null,
      itemLocations: itemLocations,
    };
  }, [shelfLayout, robotStart]);

  useEffect(() => {
    setCurrentSimState(initialWorldState);
  }, [initialWorldState]);

  useEffect(() => {
      if (isPlaying && plan && simulationStep < plan.length - 1) {
          const timer = setTimeout(() => {
              setSimulationStep(prev => prev + 1);
          }, simSpeed);
          return () => clearTimeout(timer);
      } else if (isPlaying && simulationStep >= (plan?.length ?? 0) - 1) {
          setIsPlaying(false);
      }
  }, [isPlaying, plan, simulationStep, simSpeed]);

  useEffect(() => {
      if (!plan) {
          setCurrentSimState(initialWorldState);
          return;
      };

      let state = initialWorldState;
      for (let i = 0; i <= simulationStep; i++) {
        if(i < plan.length) {
          const action = plan[i];
          const newState = { ...state, itemLocations: { ...state.itemLocations } };
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
          state = newState;
        }
      }
      setCurrentSimState(state);
  }, [simulationStep, plan, initialWorldState]);

  const handleItemToggle = (item: string) => {
    setItemsToPick(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
    handleReset();
  };

  const handleGeneratePlan = async () => {
    if (itemsToPick.length === 0) {
        setError("Please select at least one item to pick.");
        return;
    }
    setIsPlanning(true);
    setError(null);
    setPlanResult(null);
    setSimulationStep(-1);
    
    setTimeout(() => {
        try {
            const result = aStarPlanner(initialWorldState, itemsToPick, shelfLayout, collectionPoint, obstacles, GRID_SIZE);
            if (result && result.path.length > 0) {
                setPlanResult(result);
                setSimulationStep(-1);
            } else {
                setError("Could not find a plan. This might happen if an item is unreachable due to obstacles.");
            }
        } catch (e) {
            setError(`An error occurred during planning: ${e instanceof Error ? e.message : String(e)}`);
            console.error(e);
        } finally {
            setIsPlanning(false);
        }
    }, 100);
  };
  
  const handleReset = () => {
    setPlanResult(null);
    setError(null);
    setSimulationStep(-1);
    setIsPlaying(false);
    setCurrentSimState(initialWorldState);
  };
  
  const planMetrics = useMemo(() => {
    if (!plan) return null;
    const totalDistance = plan.filter(a => a.type === 'MOVE').reduce((sum, a) => sum + a.cost, 0);
    const pickDropActions = plan.filter(a => a.type === 'PICK' || a.type === 'DROP').length;
    return {
      totalActions: plan.length,
      totalDistance,
      pickDropActions,
      iterations: planResult?.iterations ?? 'N/A',
    };
  }, [plan, planResult]);

  const formatPlan = (p: Action[]): string => {
    let step = 1;
    return p.map(action => {
      let line = `${step++}. ${action.type}`;
      if (action.type === 'MOVE') {
        line += ` (${action.params.from.x},${action.params.from.y}) -> (${action.params.to.x},${action.params.to.y}) [Cost: ${action.cost}]`;
      } else if (action.type === 'PICK') {
        line += ` ${action.params.item} from ${action.params.shelfId}`;
      } else if (action.type === 'DROP') {
        line += ` ${action.params.item} at Collection Point`;
      }
      return line;
    }).join('\n');
  };

  const renderGrid = () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    
    shelfLayout.forEach(shelf => {
      grid[shelf.pos.y][shelf.pos.x] = { type: 'shelf', label: shelf.id, items: shelf.items };
    });
    
    obstacles.forEach(ob => {
        grid[ob.y][ob.x] = { type: 'obstacle' };
    });

    grid[collectionPoint.y][collectionPoint.x] = { ...grid[collectionPoint.y][collectionPoint.x], type: 'collection', label: 'Start/End' };
    
    const isItemPicked = (item: string) => {
        if (!currentSimState) return false;
        const loc = currentSimState.itemLocations[item];
        return loc === 'robot' || loc === 'collectionPoint';
    };

    const totalGridSize = GRID_SIZE * (CELL_SIZE + CELL_GAP) - CELL_GAP + (PADDING * 2);
    const posToSvg = (p: Point) => {
        const x = p.x * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + PADDING;
        const y = p.y * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + PADDING;
        return `${x},${y}`;
    }
    
    const currentAction = (plan && simulationStep >= 0 && simulationStep < plan.length) ? plan[simulationStep] : null;

    return (
      <div className="relative">
        <div className="grid grid-cols-8 gap-1 bg-slate-800 p-2 rounded-lg border border-slate-700">
            {grid.map((row, y) => 
            row.map((cell, x) => {
                const isRobotHere = currentSimState?.robotPos.x === x && currentSimState?.robotPos.y === y;
                let bgColor = 'bg-slate-800/50';
                if (cell?.type === 'shelf') bgColor = 'bg-slate-700';
                if (cell?.type === 'obstacle') bgColor = 'bg-slate-900';
                if (isRobotHere) bgColor = 'bg-sky-500/30';
                
                return (
                <div key={`${x}-${y}`} className={`w-12 h-12 flex items-center justify-center rounded transition-colors duration-300 ${bgColor}`}>
                    {cell && (
                    <div className="text-center text-xs relative">
                        {isRobotHere && (
                            currentSimState?.holding ? <ArchiveBoxArrowDownIcon className="w-8 h-8 mx-auto text-sky-300 z-10" /> : <RobotIcon className="w-8 h-8 mx-auto text-sky-300 z-10" />
                        )}
                        {cell.type === 'collection' && !isRobotHere && <FlagIcon className="w-6 h-6 mx-auto text-green-400" />}
                        {cell.type === 'shelf' && <BoxIcon className={`w-6 h-6 mx-auto ${cell.items.some(isItemPicked) ? 'text-slate-500' : 'text-amber-400'}`} />}
                        {cell.type === 'obstacle' && <StopCircleIcon className="w-6 h-6 mx-auto text-red-500/50" />}
                        <span className="font-bold">{cell.label}</span>
                        {cell.type === 'shelf' && <div className="text-slate-400">{cell.items.join(', ')}</div>}
                    </div>
                    )}
                </div>
                )
            })
            )}
        </div>
         <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${totalGridSize} ${totalGridSize}`}>
            <defs>
                <marker id="arrowhead" markerWidth="5" markerHeight="3.5" refX="0" refY="1.75" orient="auto">
                    <polygon points="0 0, 5 1.75, 0 3.5" fill="rgba(56, 189, 248, 0.5)" />
                </marker>
                 <marker id="arrowhead-active" markerWidth="5" markerHeight="3.5" refX="0" refY="1.75" orient="auto">
                    <polygon points="0 0, 5 1.75, 0 3.5" fill="rgba(125, 211, 252, 1)" />
                </marker>
            </defs>
            {plan && plan.filter(a => a.type === 'MOVE').map((action, index) => (
                <polyline 
                    key={index} 
                    points={action.params.path.map(posToSvg).join(' ')}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.3)" 
                    strokeWidth="3" 
                    strokeDasharray="4 2"
                    markerEnd="url(#arrowhead)"
                />
            ))}
             {currentAction?.type === 'MOVE' && (
                 <polyline 
                    points={currentAction.params.path.map(posToSvg).join(' ')}
                    fill="none"
                    stroke="rgba(125, 211, 252, 1)" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead-active)"
                 />
            )}
        </svg>
      </div>
    );
  };
  
  const actionDefinitions = `
ACTION: Move(from, to)
  PRECONDITION: At(robot, from), PathExists(from, to)
  EFFECT:       At(robot, to), NOT At(robot, from)

ACTION: Pick(item, shelf)
  PRECONDITION: At(robot, shelf), On(item, shelf), HandEmpty(robot)
  EFFECT:       Holding(robot, item), NOT On(item, shelf), NOT HandEmpty(robot)
  
ACTION: Drop(item, location)
  PRECONDITION: At(robot, location), Holding(robot, item)
  EFFECT:       At(item, location), HandEmpty(robot), NOT Holding(robot, item)
  `;

  return (
    <div className="min-h-screen bg-slate-900 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <div className="inline-block p-4 bg-sky-500/10 rounded-full mb-4">
            <RobotIcon className="w-16 h-16 text-sky-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Warehouse Robot Item Picker</h1>
          <p className="mt-4 text-lg text-slate-400">An Interactive Mini Project using Classical Planning</p>
        </header>

        <main className="space-y-12">
          <Section title="1. Select Items to Pick" icon={<CheckCircleIcon />}>
            <div className="flex flex-wrap gap-4">
                {allItems.map(item => (
                    <label key={item} className="flex items-center space-x-2 p-3 bg-slate-900 rounded-md border border-slate-700 cursor-pointer hover:bg-slate-700/50 transition-colors">
                        <input
                            type="checkbox"
                            checked={itemsToPick.includes(item)}
                            onChange={() => handleItemToggle(item)}
                            className="h-5 w-5 rounded bg-slate-800 border-slate-600 text-sky-500 focus:ring-sky-500"
                        />
                        <span className="font-mono text-white">{item}</span>
                    </label>
                ))}
            </div>
          </Section>

          <Section title="2. Generate and Visualize Plan" icon={<CpuChipIcon />}>
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <button 
                    onClick={handleGeneratePlan}
                    disabled={isPlanning || itemsToPick.length === 0}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    {isPlanning ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Planning...
                      </>
                    ) : 'Generate Plan'}
                  </button>
                  <button onClick={handleReset} className="p-3 bg-slate-700/50 rounded-md hover:bg-slate-700 transition-colors" aria-label="Reset">
                    <ArrowUturnLeftIcon className="w-6 h-6"/>
                  </button>
                </div>
                 {plan && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-700 rounded-md">
                            <button onClick={() => setSimulationStep(s => Math.max(-1, s - 1))} disabled={simulationStep < 0} className="p-2 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">
                                <BackwardIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationStep >= plan.length -1} className="p-2 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">
                                {isPlaying ? <StopIcon className="w-5 h-5 text-yellow-400" /> : <PlayIcon className="w-5 h-5" />}
                            </button>
                             <button onClick={() => setSimulationStep(s => Math.min(plan.length -1, s + 1))} disabled={simulationStep >= plan.length -1} className="p-2 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">
                                <ForwardIcon className="w-5 h-5"/>
                            </button>
                            <input
                            type="range"
                            min="-1"
                            max={plan.length - 1}
                            value={simulationStep}
                            onChange={(e) => { setIsPlaying(false); setSimulationStep(parseInt(e.target.value)); }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-sm font-mono tabular-nums">{simulationStep + 1}/{plan.length}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Speed:</span>
                            <input type="range" min="100" max="1500" step="100" value={simSpeed} onChange={e => setSimSpeed(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer invert"/>
                        </div>
                    </div>
                )}
                {currentSimState?.holding && (
                  <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-md text-center flex items-center justify-center gap-2">
                    <ArchiveBoxArrowDownIcon className="w-5 h-5 text-green-300"/>
                    <p className="font-semibold text-green-300">Robot is holding: <span className="font-mono">{currentSimState.holding}</span></p>
                  </div>
                )}
              </div>
              <div className="flex justify-center lg:justify-end">
                {renderGrid()}
              </div>
            </div>
          </Section>

          <Section title="3. Generated Plan" icon={<DocumentTextIcon />}>
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
            {!plan && !error && !isPlanning && <p className="text-slate-400">Click "Generate Plan" to see the robot's optimal action sequence here.</p>}
            {isPlanning && <p className="text-sky-400">Planner is searching for the optimal path...</p>}
            {plan && <CodeBlock language="text" code={formatPlan(plan)} />}
          </Section>

          {planMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Section title="4. Plan Metrics" icon={<ChartBarIcon />}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-sky-400">{planMetrics.totalActions}</p>
                    <p className="text-sm text-slate-400">Total Actions</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-sky-400">{planMetrics.totalDistance}</p>
                    <p className="text-sm text-slate-400">Total Distance Traveled</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-sky-400">{planMetrics.pickDropActions}</p>
                    <p className="text-sm text-slate-400">Pick & Drop Operations</p>
                  </div>
                </div>
              </Section>
              <Section title="Planner Insights" icon={<CubeTransparentIcon />}>
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-sky-400">{planMetrics.iterations}</p>
                    <p className="text-sm text-slate-400">States Explored by Planner</p>
                </div>
              </Section>
            </div>
          )}

          <Section title="5. Methodology: AI Planning in Action" icon={<LightBulbIcon />}>
              <p>This simulation uses a <strong>classical AI planning</strong> approach to determine the robot's actions. The planner searches through a vast space of possible future states to find an optimal sequence of actions that transforms the initial state into a desired goal state.</p>
              
              <h3 className="text-xl font-semibold text-white mt-6 mb-2">State-Space Representation</h3>
              <p>The "world" is defined by a concise state representation. At any moment, the state includes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Robot Position:</strong> The <code>(x, y)</code> coordinates of the robot on the grid.</li>
                <li><strong>Robot Hand Status:</strong> Whether the robot is <code>holding</code> an item or is empty (<code>null</code>).</li>
                <li><strong>Item Locations:</strong> A mapping of each item to its current location (e.g., <code>'S1'</code>, <code>'robot'</code>, or <code>'collectionPoint'</code>).</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mt-6 mb-2">Actions (Operators)</h3>
              <p>The planner uses a set of defined actions, inspired by the STRIPS (Stanford Research Institute Problem Solver) formalism. Each action has preconditions (what must be true to perform it) and effects (how it changes the world state).</p>
              <CodeBlock language="plaintext" code={actionDefinitions} />

              <h3 className="text-xl font-semibold text-white mt-6 mb-2">Goal & Path Optimization with A*</h3>
              <p>The <strong>goal</strong> is simple: all items selected by the user must be at the <code>'collectionPoint'</code>. To find the most efficient path to this goal, the planner uses the <strong>A* (A-star) search algorithm</strong>. A* is an informed search algorithm that avoids exploring unpromising paths.</p>
              <p>It balances two key factors:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>g(n)</code>: The actual cost to get from the start state to the current state <code>n</code>. For movement, this is the true distance calculated by a nested A* search that navigates around obstacles.</li>
                <li><code>h(n)</code>: A "heuristic" or educated guess of the cost to get from the current state <code>n</code> to the goal. Our heuristic penalizes uncollected items and prioritizes moving to the collection point when holding an item.</li>
              </ul>
              <p>By always exploring the state with the lowest <code>f(n) = g(n) + h(n)</code>, A* efficiently finds a plan that minimizes the total cost—in this case, primarily the robot's travel distance.</p>
          </Section>
        </main>
        
        <footer className="text-center mt-16 py-8 border-t border-slate-800">
          <p className="text-slate-500">AI Mini Project Model | Interactive Simulation</p>
        </footer>
      </div>
    </div>
  );
};

export default App;