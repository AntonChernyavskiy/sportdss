document.addEventListener('DOMContentLoaded', function () {
    fetch('/files')
        .then(response => response.json())
        .then(data => {
            const startlistsContainer = document.getElementById('startlists');
            const competitionsContainer = document.getElementById('competitions-files');

            const upcomingEvents = [];
            const pastEvents = [];

            data.forEach(entry => {
                const [date, eventName] = entry.split('  ');
                const event = { date: date, name: eventName };
                if (new Date(date) >= new Date()) {
                    upcomingEvents.push(event);
                } else {
                    pastEvents.push(event);
                }
            });

            function createEventListItem(event, container, isPastEvent) {
                const li = document.createElement('li');
                const div = document.createElement('div');
                div.classList.add('event-details');

                const h3 = document.createElement('h3');
                h3.textContent = event.name;

                const p = document.createElement('p');
                p.classList.add('event-dates');
                p.textContent = event.date;

                const divButtons = document.createElement('div');
                divButtons.classList.add('event-buttons');

                const resultBtn = document.createElement('a');
                resultBtn.classList.add('event-btn');
                resultBtn.href = 'results.html';
                resultBtn.textContent = 'Rezultāti';
                resultBtn.setAttribute('data-event', event.name);

                divButtons.appendChild(resultBtn);

                if (!isPastEvent) {
                    const registerBtn = document.createElement('a');
                    registerBtn.classList.add('event-btn');
                    registerBtn.href = '#';
                    registerBtn.textContent = 'Pieteikties';
                    registerBtn.setAttribute('data-event', event.name);
                    registerBtn.setAttribute('data-date', event.date);
                    registerBtn.classList.add('register-btn');
                    checkRegistrationForm(registerBtn, event.date, event.name);

                    divButtons.appendChild(registerBtn);
                }

                div.appendChild(h3);
                div.appendChild(p);
                div.appendChild(divButtons);

                li.appendChild(div);
                container.appendChild(li);
            }

            function checkRegistrationForm(button, eventDate, eventName) {
                fetch(`/entrySys/${eventDate}%20%20${eventName}/config.json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Form not found');
                        }
                        return response.json();
                    })
                    .then(config => {
                        // Load form content dynamically
                        const formHtml = generateFormHtml(config);
                        document.getElementById('includedContent').innerHTML = formHtml;
                        button.classList.remove('inactive');
                    })
                    .catch(error => {
                        button.classList.add('inactive');
                        button.style.pointerEvents = 'none';
                        button.style.backgroundColor = 'grey';
                        console.error('Error loading registration form:', error);
                    });
            }

            function generateFormHtml(config) {
                let html = `
                    <form id="registration-form">
                        <div class="form-group">
                            <label for="organization">Organization:</label>
                            <select id="organization" name="organization">
                                <option value="SASS">MSĢ TSV SASS</option>
                                <option value="JMSG">MSĢ TSV Jūrmala</option>
                                <option value="DJSS">Daugavpils Sporta skola</option>
                                <option value="JJSS">Jelgavas BJSS</option>
                                <option value="LATC">LATC</option>
                                <option value="KRAK">Rīgas Airētāju klubs</option>
                                <option value="BLAK">Lielupes airēšanas klubs</option>
                                <option value="KAIR">Airusports</option>
                                <option value="Other">Other</option>
                            </select>
                            <input type="text" id="other-organization" name="otherOrganization" style="display: none;">
                        </div>
                        <div class="form-group">
                            <label for="boat-class">Boat Class:</label>
                            <select id="boat-class" name="boatClass">
                                <option value="M1x">M1x</option>
                                <option value="W1x">W1x</option>
                                <option value="M2x">M2x</option>
                                <option value="W2x">W2x</option>
                                <option value="M2-">M2-</option>
                                <option value="W2-">W2-</option>
                                <option value="M4x">M4x</option>
                                <option value="W4x">W4x</option>
                                <option value="M4-">M4-</option>
                                <option value="W4-">W4-</option>
                                <option value="M4+">M4+</option>
                                <option value="W4+">W4+</option>
                                <option value="M8+">M8+</option>
                                <option value="W8+">W8+</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Participants:</label>
                            <table id="participantsTable">
                                <thead>
                                    <tr>
                                        <th>Birth Year</th>
                                        <th>First Name</th>
                                        <th>Last Name</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <div class="form-group">
                            <label for="contact-information">Contact Information:</label>
                            <input type="text" id="contact-information" name="contactInformation" required>
                        </div>
                        <button type="submit" id="submit-button">Submit</button>
                    </form>
                `;
                return html;
            }

            upcomingEvents.forEach(event => createEventListItem(event, startlistsContainer, false));
            pastEvents.forEach(event => createEventListItem(event, competitionsContainer, true));

            function fetchAndDisplayRegistrationForm(eventName, eventDate) {
                // Populate modal title
                document.getElementById('modal-title').textContent = `${eventName} - ${eventDate}`;

                // Show the modal
                document.getElementById('registration-modal').style.display = 'flex';
            }

            document.querySelector('.close-modal').addEventListener('click', function () {
                document.getElementById('registration-modal').style.display = 'none';
            });

            document.addEventListener('click', function (event) {
                if (event.target && event.target.classList.contains('register-btn')) {
                    event.preventDefault();
                    const eventName = event.target.getAttribute('data-event');
                    const eventDate = event.target.getAttribute('data-date');
                    fetchAndDisplayRegistrationForm(eventName, eventDate);
                }
            });

            document.getElementById('organization').addEventListener('change', function () {
                const otherOrganizationInput = document.getElementById('other-organization');
                if (this.value === 'Other') {
                    otherOrganizationInput.style.display = 'block';
                } else {
                    otherOrganizationInput.style.display = 'none';
                }
            });

            // Function to handle adding rows to participants table
            function handleBoatClassChange() {
                const category = document.getElementById('boat-class').value;
                const participantsTable = document.getElementById('participantsTable').getElementsByTagName('tbody')[0];
                participantsTable.innerHTML = '';

                let numParticipants = 1;
                let coxswainIndex = -1;
                switch (category) {
                    case 'M1x':
                    case 'W1x':
                        numParticipants = 1;
                        break;
                    case 'M2x':
                    case 'M2-':
                    case 'W2x':
                    case 'W2-':
                        numParticipants = 2;
                        break;
                    case 'M4x':
                    case 'M4-':
                    case 'W4x':
                    case 'W4-':
                        numParticipants = 4;
                        break;
                    case 'M4+':
                    case 'W4+':
                        numParticipants = 5;
                        coxswainIndex = 4;
                        break;
                    case 'M8+':
                    case 'W8+':
                        numParticipants = 9;
                        coxswainIndex = 8;
                        break;
                    default:
                        break;
                }

                for (let i = 0; i < numParticipants; i++) {
                    const newRow = participantsTable.insertRow();
                    newRow.innerHTML = `
                        <td>
                            <input type="number" id="birthYear${i + 1}" name="birthYear${i + 1}" min="1900" max="2024" required>
                        </td>
                        <td>
                            <input type="text" id="firstName${i + 1}" name="firstName${i + 1}" required>
                        </td>
                        <td>
                            <input type="text" id="lastName${i + 1}" name="lastName${i + 1}" required>
                        </td>
                    `;
                    if (i === coxswainIndex) {
                        newRow.classList.add('highlight');
                    }
                }
            }

            // Attach event listener for boat class change
            document.addEventListener('change', function (event) {
                if (event.target && event.target.id === 'boat-class') {
                    handleBoatClassChange();
                }
            });

            // Initial setup in case there's a pre-selected boat class
            handleBoatClassChange();

            // Handle form submission
            document.getElementById('registration-form').addEventListener('submit', function (event) {
                event.preventDefault();

                // Example of form submission handling
                const formData = new FormData(this);
                const serializedData = {};
                formData.forEach((value, key) => {
                    serializedData[key] = value;
                });

                console.log('Form data:', serializedData);

                // Here you can handle form submission to your server or perform other actions
                // For demonstration purposes, we're just logging the form data
            });
        })
        .catch(error => console.error('Error loading files:', error));
});
