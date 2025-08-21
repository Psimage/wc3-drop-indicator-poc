import {Effect, MapPlayer, Timer, Trigger, Unit} from "w3ts";
import {addScriptHook, W3TS_HOOK} from "w3ts/hooks";
import {Units} from "@objectdata/units";
import {id2FourCC} from './util'

interface UnitModelHeight {
    sdHeight: number;
    hdHeight: number;
}

const UNITS_HEIGHT_DATA: Record<string, UnitModelHeight> = compiletime(() => {
    const fs = require("fs-extra");
    const heights = JSON.parse(fs.readFileSync("./unitModelHeightData.json", "utf8")) as Record<string, UnitModelHeight>;

    // Override some values

    // Flying dragons
    [
        'nbwm', 'nbdk', 'nbdr', //black dragons
        'nbzd', 'nbzk', 'nbzw', //bronze dragons
        'nadk', 'nadr', 'nadw', //blue dragons
        'ngrd', 'ngdk', 'ngrw', //green dragons
        'nrwm', 'nrdk', 'nrdr', //red dragons
    ].forEach((unitType => heights[unitType].sdHeight += 40));

    // Murlocks
    [
        'nmrm', 'nmrr', 'nmpg', 'nmrl', 'nmmu',
    ].forEach((unitType => heights[unitType].sdHeight += 16.5));

    // Eredar
    [
        'ners', 'nerw'
    ].forEach((unitType => heights[unitType].sdHeight += 40));

    return heights
}) as Record<string, UnitModelHeight>;

const CREEP_UNIT_TYPES: string[] = compiletime(({objectData}) => {
    return Object.keys(objectData.units.game).filter(unitType => {
        const u = objectData.units.get(unitType)!;
        return u.race === "creeps" && u.hero === "";
    });
}) as string[];

function tsMain() {
    try {
        print("Toggle BlzAttachEffect: B")
        print("Toggle     AttachEffect: N")
        main()
    } catch (e) {
        print(e)
    }
}

function main() {
    createGrid(CREEP_UNIT_TYPES.length, (idx, x, y) => {
        const unitType = CREEP_UNIT_TYPES[idx];
        const u = Unit.create(MapPlayer.fromLocal(), FourCC(unitType), x, y, 0)!;
        attachEffect(u);
        blzAttachEffect(u);
        registerPrintDebugInfoOnSelect(u);
    });

    attachEffect(Unit.create(MapPlayer.fromLocal(), FourCC(Units.SpiritBearLevel3), -900, -8000, 0)!);
    attachEffect(Unit.create(MapPlayer.fromLocal(), FourCC(Units.BlackDragon), -2500, -9500, 0)!);
}

function attachEffect(u: Unit,
                      hpModel: string = "test-offset-pivot-hp.mdx",
                      mpModel: string = "test-offset-pivot-mp.mdx") {
    let e: Effect;
    //Instead of 2 models, we can use 1 model with 2 animations
    if (u.maxMana > 0) { //has mana bar
        e = Effect.create(mpModel, 0, 0)!;
    } else {
        e = Effect.create(hpModel, 0, 0)!;
    }

    e.setColor(100, 255, 255) //tint to debug, distinguish from BlzAttachEffect

    Timer.create().start(0.01, true, () => {
        positionEffectAtHpBarPivot(e, u)
    })

    toggleOnKeyDown(true, OSKEY_N, (isOn) => {
        e.scale = isOn ? 1.0 : 0;
    });
}

function positionEffectAtHpBarPivot(e: Effect, u: Unit) {
    const hpPivot = calculateHealthBarPivot(u);
    e.setPosition(hpPivot.x, hpPivot.y, hpPivot.z);
}

function calculateHealthBarPivot(u: Unit) {
    let x, y, z;
    let uScale = getUnitTypeScale(u)
    let uModelHeight = UNITS_HEIGHT_DATA[id2FourCC(u.skin)].sdHeight;

    // For some collision sizes Unit's position is off with HP bar
    if (u.collisionSize != 32 && u.collisionSize != 47) {
        x = u.x - 16;
        y = u.y - 16;
    } else {
        x = u.x;
        y = u.y;
    }

    z = u.localZ + u.getflyHeight() + uModelHeight * uScale + 16.5;

    return {x, y, z, uModelHeight};
}

function blzAttachEffect(u: Unit, modelName: string = "test-bottom-middle-pivot.mdx") {
    const e = Effect.createAttachment(modelName, u, "overhead")!;
    e.scale = 0; //hide

    toggleOnKeyDown(false, OSKEY_B, (isOn) => {
        if (isOn) {
            e.scale = 1.0 / getUnitTypeScale(u) // "unscale" effect from an inherited unit scale
        } else {
            e.scale = 0;
        }
    });
}

function createGrid(numCells: number, callback: (idx: number, x: number, y: number) => void) {
    const CELL_SIZE = 200;
    const START_X = -1800;
    const START_Y = 2000;

    const COLS = Math.ceil(Math.sqrt(numCells)); // roughly square grid

    for (let i = 0; i < numCells; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);

        const x = START_X + col * CELL_SIZE;
        const y = START_Y - row * CELL_SIZE;

        callback(i, x, y);
    }
}

function toggleOnKeyDown(initialState: boolean, key: oskeytype, action: (isOn: boolean) => void) {
    const t = Trigger.create();
    t.registerPlayerKeyEvent(MapPlayer.fromLocal(), key, 0, true);
    let isOn = initialState;
    t.addAction(() => {
        isOn = !isOn;
        action(isOn);
    })
}

function registerPrintDebugInfoOnSelect(u: Unit) {
    const t = Trigger.create();
    t.registerUnitEvent(u, EVENT_UNIT_SELECTED);
    t.addAction(() => {
        const u = Unit.fromEvent()!;
        print(`unitType: ${id2FourCC(u.typeId)}`)
        print(`modelScale: ${getUnitTypeScale(u)}`)
        print(`uModelHeight: ${calculateHealthBarPivot(u).uModelHeight}`)
        print(`flyHeight: ${u.getflyHeight()}`)
        print(`defaultFlyHeight: ${u.defaultFlyHeight}`)
        print(`localZ: ${u.localZ}`)
        print(`Z: ${u.z}`)
        print(`collisionSize: ${u.collisionSize}`)
    })
}

// Type scale, not runtime scale. 'Art - Scaling Value' in WE
function getUnitTypeScale(u: Unit) {
    return BlzGetUnitRealField(u.handle, UNIT_RF_SCALING_VALUE);
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, tsMain);
