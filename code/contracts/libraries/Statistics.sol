// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "hardhat/console.sol";

/// @notice Simple statistic library for uint256 arrays, numbers are treat as fixed-precision floats.
library Statistics {
    /// @notice Compute the mean of the data.
    /// @param data The data to compute the mean for.
    function avg(uint256[] memory data) internal pure returns (uint256 ans) {
        uint256 sum = 0;
        for (uint256 i = 0; i < data.length; i++) {
            sum += data[i];
        }
        ans = sum / data.length;
    }

    /// @notice Compute the variance of the data.
    /// @param data The data to compute the variance for.
    function variance(uint256[] memory data) internal pure returns (uint256 ans, uint256 mean) {
        mean = avg(data);
        uint256 sum = 0;
        for (uint256 i = 0; i < data.length; i++) {
            //@audit-ok !!! should be int256 : 8 - 10  => revert if mean > data[i] => func is used in stddev => finalizeValidation
            //Variance should be calculated by squaring the difference between each data point and the mean.
            //However, if mean > data[i], the line uint256 diff = data[i] - mean; will revert due to underflow.
            //In Solidity 0.8.x, underflow and overflow revert by default, so you’ll want to handle cases where data[i] < mean
            //require(data.length > 0, "Data cannot be empty");
            // for (uint256 i = 0; i < data.length; i++) {
            //     int256 diff = int256(data[i]) - int256(mean); // Cast to int256 to handle negative differences
            //     sum += uint256(diff * diff); // Convert back to uint256 for the sum
            // }

            //console.log("Score - Mean: ", data[i], mean);

            int256 diff = int256(data[i]) - int256(mean);
            sum += uint256(diff * diff);
            // uint256 diff = data[i] - mean;
            // sum += diff * diff;
        }
        ans = sum / data.length;
    }

    /// @notice Compute the standard deviation of the data.
    /// @dev Computes variance, and takes the square root.
    /// @param data The data to compute the standard deviation for.
    function stddev(uint256[] memory data) internal pure returns (uint256 ans, uint256 mean) {
        (uint256 _variance, uint256 _mean) = variance(data);
        mean = _mean;
        ans = sqrt(_variance);
    }

    /// @notice Compute the square root of a number.
    /// @dev Uses Babylonian method.
    /// @param x The number to compute the square root for.
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
