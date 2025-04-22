import * as React from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import CircularProgress from '@mui/material/CircularProgress'; // For loading indicator
import Typography from '@mui/material/Typography'; // For messages

import { useRepos } from "../contexts/RepoContext";


export default function BasicSelect() {
    // Destructure state and functions from context, including error
    const { repositories, reposLoading, selectedRepo, selectRepo } = useRepos();

    // MUI Select's onChange handler provides an event object
    const handleChange = (event: SelectChangeEvent) => {
        // The selected value is in event.target.value
        selectRepo(event.target.value as string);
    };

    // Handle Loading State
    if (reposLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading repositories...</Typography>
            </Box>
        );
    }


    // Handle No Repositories Found (after loading and no error)
    if (!Array.isArray(repositories) || repositories.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Typography>No repositories found.</Typography>
            </Box>
        );
    }

    // Render the Select component
    return (
        // Center the Box and give it some padding/margin if needed
        <Box sx={{ width: '100%', maxWidth: 400, margin: '20px auto', padding: 2 }}>
            <FormControl fullWidth>
                <InputLabel id="repo-select-label">Repositories</InputLabel>
                <Select
                    labelId="repo-select-label"
                    id="repo-select"
                    // Bind the value to selectedRepo from context.
                    // Default to '' if null, as Select expects a string value.
                    value={selectedRepo || ''}
                    label="Repositories" // Match the InputLabel
                    onChange={handleChange} // Use the correct handler
                >
                    {/* Add a default/placeholder option if desired */}
                    {/* <MenuItem value="" disabled>
                        Select a repository...
                    </MenuItem> */}

                    {/* Map over the repositories array */}
                    {repositories.map((repoName) => (
                        // Each MenuItem needs a unique key and a value
                        <MenuItem key={repoName} value={repoName}>
                            {repoName}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {/* Optionally display the selected repo below */}
            {/* {selectedRepo && (
                <Typography sx={{ mt: 2, textAlign: 'center' }}>
                    Selected: {selectedRepo}
                </Typography>
            )} */}
        </Box>
    );
}