#pragma once
#include "types.hpp"
#include <cstring>
#include <cstdint>

namespace EarthDefender {

constexpr int GRID_COLS = 16;
constexpr int GRID_ROWS = 12;
constexpr int CELL_SIZE = 50;
constexpr int MAX_ITEMS_PER_CELL = 32;

struct SpatialCell {
    uint16_t count;
    uint16_t entityIndices[MAX_ITEMS_PER_CELL];
};

class SpatialHashGrid {
public:
    SpatialCell cells[GRID_ROWS][GRID_COLS];
    uint32_t totalInserts;
    uint32_t totalQueries;

    void clear() {
        std::memset(cells, 0, sizeof(cells));
        totalInserts = 0;
        totalQueries = 0;
    }

    inline void getCellCoords(float x, float y, int& outCol, int& outRow) const {
        // Shift x,y from [-HALF_WIDTH, HALF_WIDTH] to [0, WORLD_WIDTH]
        float screenX = x + HALF_WIDTH;
        float screenY = y + HALF_HEIGHT;

        outCol = static_cast<int>(screenX / CELL_SIZE);
        outRow = static_cast<int>(screenY / CELL_SIZE);

        if (outCol < 0) outCol = 0;
        if (outCol >= GRID_COLS) outCol = GRID_COLS - 1;
        if (outRow < 0) outRow = 0;
        if (outRow >= GRID_ROWS) outRow = GRID_ROWS - 1;
    }

    void insert(uint16_t entityIndex, float x, float y, float radius) {
        int minCol, minRow, maxCol, maxRow;
        getCellCoords(x - radius, y - radius, minCol, minRow);
        getCellCoords(x + radius, y + radius, maxCol, maxRow);

        for (int r = minRow; r <= maxRow; ++r) {
            for (int c = minCol; c <= maxCol; ++c) {
                SpatialCell& cell = cells[r][c];
                if (cell.count < MAX_ITEMS_PER_CELL) {
                    cell.entityIndices[cell.count++] = entityIndex;
                    totalInserts++;
                }
            }
        }
    }

    // Query callback function
    template <typename Callback>
    inline void queryRange(float x, float y, float radius, Callback&& callback) {
        int minCol, minRow, maxCol, maxRow;
        getCellCoords(x - radius, y - radius, minCol, minRow);
        getCellCoords(x + radius, y + radius, maxCol, maxRow);

        // Deduplication bitmask for up to 256 unique entity queries
        uint64_t seenBitmask[4] = {0, 0, 0, 0};

        for (int r = minRow; r <= maxRow; ++r) {
            for (int c = minCol; c <= maxCol; ++c) {
                const SpatialCell& cell = cells[r][c];
                for (int i = 0; i < cell.count; ++i) {
                    uint16_t id = cell.entityIndices[i];
                    int maskIdx = id >> 6;
                    uint64_t bit = 1ULL << (id & 63);

                    if (maskIdx < 4 && !(seenBitmask[maskIdx] & bit)) {
                        seenBitmask[maskIdx] |= bit;
                        totalQueries++;
                        if (!callback(id)) {
                            return; // Early termination if requested by callback
                        }
                    }
                }
            }
        }
    }
};

} // namespace EarthDefender
