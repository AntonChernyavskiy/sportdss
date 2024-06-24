document.addEventListener('DOMContentLoaded', function () {
    const createFolderBtn = document.getElementById('create-folder-btn');
    const deleteFolderBtn = document.getElementById('delete-folder-btn');
    const createFolderModal = document.getElementById('create-folder-modal');
    const deleteFolderModal = document.getElementById('delete-folder-modal');
    const closeModalBtns = document.querySelectorAll('.modal .close');
    const createFolderForm = document.getElementById('create-folder-form');
    const foldersListContainer = document.getElementById('folders-list');

    // Show modal on create folder button click
    createFolderBtn.addEventListener('click', function () {
        createFolderModal.style.display = 'flex';
    });

    // Show modal on delete folder button click
    deleteFolderBtn.addEventListener('click', function () {
        fetch('/folders')
            .then(response => response.json())
            .then(data => {
                foldersListContainer.innerHTML = '';
                data.forEach(folder => {
                    const folderItem = document.createElement('div');
                    folderItem.textContent = folder;
                    folderItem.classList.add('folder-item');
                    folderItem.addEventListener('click', function () {
                        if (confirm(`Are you sure you want to delete folder: ${folder}?`)) {
                            deleteFolder(folder);
                        }
                    });
                    foldersListContainer.appendChild(folderItem);
                });
                deleteFolderModal.style.display = 'flex';
            })
            .catch(error => {
                console.error('Error fetching folders:', error);
                alert('Failed to fetch folders. Please try again.');
            });
    });

    // Close modal when close button or overlay is clicked
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            createFolderModal.style.display = 'none';
            deleteFolderModal.style.display = 'none';
        });
    });

    // Close modal when clicking outside of the modal content
    window.addEventListener('click', function (event) {
        if (event.target === createFolderModal || event.target === deleteFolderModal) {
            createFolderModal.style.display = 'none';
            deleteFolderModal.style.display = 'none';
        }
    });

    // Handle form submission for creating a folder
    createFolderForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const eventDate = document.getElementById('event-date').value.trim();
        const eventName = document.getElementById('event-name').value.trim();

        if (!eventDate || !eventName) {
            alert('Please enter both Event Date and Event Name.');
            return;
        }

        // Send a POST request to create the folder
        fetch(`/folders/${encodeURIComponent(eventDate)}  ${encodeURIComponent(eventName)}`, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to create folder');
            }
            // Folder created successfully
            alert('Folder created successfully!');
            createFolderModal.style.display = 'none';
            fetchFolders(); // Refresh folders list after creation
        })
        .catch(error => {
            console.error('Error creating folder:', error);
            alert('Failed to create folder. Please try again.');
        });
    });

    function deleteFolder(folderName) {
        fetch(`/folders/${encodeURIComponent(folderName)}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete folder');
            }
            alert(`Folder ${folderName} deleted successfully!`);
            deleteFolderModal.style.display = 'none';
            fetchFolders(); // Refresh folders list after deletion
        })
        .catch(error => {
            console.error('Error deleting folder:', error);
            alert('Failed to delete folder. Please try again.');
        });
    }

    function fetchFolders() {
        fetch('/folders')
            .then(response => response.json())
            .then(data => {
                // Update competitions list
                const competitionsContainer = document.getElementById('competitions-files');
                competitionsContainer.innerHTML = '';

                data.sort((a, b) => {
                    const [dateA,] = a.split('  ');
                    const [dateB,] = b.split('  ');
                    return new Date(dateB) - new Date(dateA);
                });

                data.forEach(entry => {
                    const [eventDate, eventName] = entry.split('  ');
                    const li = document.createElement('li');
                    li.textContent = `${eventName} (${eventDate})`;
                    li.addEventListener('click', function () {
                        fetchAndDisplayResults(eventName, eventDate);
                    });
                    competitionsContainer.appendChild(li);
                });

                // Update folders list
                foldersListContainer.innerHTML = '';
                data.forEach(folder => {
                    const folderItem = document.createElement('div');
                    folderItem.textContent = folder;
                    folderItem.classList.add('folder-item');
                    folderItem.addEventListener('click', function () {
                        if (confirm(`Are you sure you want to delete folder: ${folder}?`)) {
                            deleteFolder(folder);
                        }
                    });
                    foldersListContainer.appendChild(folderItem);
                });
            })
            .catch(error => {
                console.error('Error fetching folders:', error);
                alert('Failed to fetch folders. Please try again.');
            });
    }

    function populateResultsTable(files, eventName, eventDate) {
        const resultsListContainer = document.getElementById('results-list').getElementsByTagName('tbody')[0];
        resultsListContainer.innerHTML = '';

        files.forEach(file => {
            const tr = document.createElement('tr');

            // File Name column
            const fileNameCell = document.createElement('td');
            fileNameCell.textContent = file;
            tr.appendChild(fileNameCell);

            // Actions column
            const actionsCell = document.createElement('td');
            actionsCell.classList.add('action-buttons');

            // View link
            const viewLink = document.createElement('a');
            viewLink.textContent = 'View';
            viewLink.href = `/results/${encodeURIComponent(eventName)}/${encodeURIComponent(file)}`;
            viewLink.target = '_blank';
            viewLink.classList.add('btn', 'btn-view');
            actionsCell.appendChild(viewLink);

            // Download link
            const downloadLink = document.createElement('a');
            downloadLink.textContent = 'Download';
            downloadLink.href = `/results/download/${encodeURIComponent(eventName)}/${encodeURIComponent(file)}`;
            downloadLink.classList.add('btn', 'btn-download');
            actionsCell.appendChild(downloadLink);

            tr.appendChild(actionsCell);
            resultsListContainer.appendChild(tr);
        });
    }

    function fetchAndDisplayResults(eventName, eventDate) {
        fetch(`/results/${encodeURIComponent(eventName)}`)
            .then(response => response.json())
            .then(data => {
                populateResultsTable(data.files, eventName, eventDate);
            })
            .catch(error => {
                console.error(`Error fetching results for event ${eventName}:`, error);
                alert(`Failed to fetch results for event ${eventName}. Please try again.`);
            });
    }

    // Initially fetch folders and display them
    fetchFolders();
});

